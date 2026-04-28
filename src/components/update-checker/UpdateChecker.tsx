import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { ProgressBar } from "../shared";
import { useSettings } from "../../hooks/useSettings";
import { commands } from "../../bindings";

interface UpdateCheckerProps {
  className?: string;
}

type UpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "installing"
  | "restarting"
  | "restart-ready";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const closeUpdate = async (update: { close: () => Promise<void> }) => {
  try {
    await update.close();
  } catch (error) {
    console.error("Failed to close update resource:", error);
  }
};

const UpdateChecker: React.FC<UpdateCheckerProps> = ({ className = "" }) => {
  const { t } = useTranslation();
  // Update checking state
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [showPortableUpdateDialog, setShowPortableUpdateDialog] =
    useState(false);

  const { settings, isLoading } = useSettings();
  const settingsLoaded = !isLoading && settings !== null;
  const updateChecksEnabled = settings?.update_checks_enabled ?? false;

  const upToDateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isManualCheckRef = useRef(false);
  const downloadedBytesRef = useRef(0);
  const contentLengthRef = useRef(0);

  const isChecking = updatePhase === "checking";
  const isUpdating =
    updatePhase === "downloading" ||
    updatePhase === "installing" ||
    updatePhase === "restarting";

  useEffect(() => {
    // Wait for settings to load before doing anything
    if (!settingsLoaded) return;

    if (!updateChecksEnabled) {
      if (upToDateTimeoutRef.current) {
        clearTimeout(upToDateTimeoutRef.current);
      }
      setUpdatePhase("idle");
      setUpdateAvailable(false);
      setShowUpToDate(false);
      return;
    }

    checkForUpdates();

    // Listen for update check events
    const updateUnlisten = listen("check-for-updates", () => {
      handleManualUpdateCheck();
    });

    return () => {
      if (upToDateTimeoutRef.current) {
        clearTimeout(upToDateTimeoutRef.current);
      }
      updateUnlisten.then((fn) => fn());
    };
  }, [settingsLoaded, updateChecksEnabled]);

  // Update checking functions
  const checkForUpdates = async () => {
    if (!updateChecksEnabled || isChecking) return;

    try {
      setUpdatePhase("checking");
      const update = await check();

      if (update) {
        setUpdateAvailable(true);
        setShowUpToDate(false);
      } else {
        setUpdateAvailable(false);

        if (isManualCheckRef.current) {
          setShowUpToDate(true);
          if (upToDateTimeoutRef.current) {
            clearTimeout(upToDateTimeoutRef.current);
          }
          upToDateTimeoutRef.current = setTimeout(() => {
            setShowUpToDate(false);
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      toast.error("Failed to check for updates", {
        description: getErrorMessage(error),
      });
    } finally {
      setUpdatePhase("idle");
      isManualCheckRef.current = false;
    }
  };

  const handleManualUpdateCheck = () => {
    if (!updateChecksEnabled) return;
    isManualCheckRef.current = true;
    checkForUpdates();
  };

  const resetInstallState = () => {
    setDownloadProgress(0);
    downloadedBytesRef.current = 0;
    contentLengthRef.current = 0;
  };

  const handleDownloadEvent = (event: DownloadEvent) => {
    switch (event.event) {
      case "Started":
        setUpdatePhase("downloading");
        downloadedBytesRef.current = 0;
        contentLengthRef.current = event.data.contentLength ?? 0;
        setDownloadProgress(0);
        break;
      case "Progress": {
        downloadedBytesRef.current += event.data.chunkLength;
        const progress =
          contentLengthRef.current > 0
            ? Math.round(
                (downloadedBytesRef.current / contentLengthRef.current) * 100,
              )
            : 0;
        setDownloadProgress(Math.min(progress, 99));
        break;
      }
      case "Finished":
        setDownloadProgress(100);
        setUpdatePhase("installing");
        break;
    }
  };

  const restartApp = async () => {
    try {
      setUpdatePhase("restarting");
      await relaunch();
      setUpdatePhase("restart-ready");
    } catch (error) {
      console.error("Failed to restart after update:", error);
      setUpdatePhase("restart-ready");
      toast.error("Update installed, but restart failed", {
        description: getErrorMessage(error),
      });
    }
  };

  const installUpdate = async () => {
    if (!updateChecksEnabled) return;

    try {
      const portable = await commands.isPortable();
      if (portable) {
        setShowPortableUpdateDialog(true);
        return;
      }

      setUpdatePhase("checking");
      resetInstallState();
      const update = await check();

      if (!update) {
        console.log("No update available during install attempt");
        setUpdateAvailable(false);
        setShowUpToDate(true);
        setUpdatePhase("idle");
        return;
      }

      try {
        await update.download(handleDownloadEvent);
        setUpdatePhase("installing");
        await update.install();
      } finally {
        await closeUpdate(update);
      }

      setUpdateAvailable(false);
      await restartApp();
    } catch (error) {
      console.error("Failed to install update:", error);
      setUpdatePhase("idle");
      resetInstallState();
      toast.error("Failed to install update", {
        description: getErrorMessage(error),
      });
    }
  };

  // Update status functions
  const getUpdateStatusText = () => {
    if (!updateChecksEnabled) {
      return t("footer.updateCheckingDisabled");
    }
    if (updatePhase === "downloading") {
      return downloadProgress > 0
        ? t("footer.downloading", {
            progress: downloadProgress.toString().padStart(3),
          })
        : t("footer.preparing");
    }
    if (updatePhase === "installing") return t("footer.installing");
    if (updatePhase === "restarting") return t("footer.restart");
    if (updatePhase === "restart-ready") return t("footer.restart");
    if (isChecking) return t("footer.checkingUpdates");
    if (showUpToDate) return t("footer.upToDate");
    if (updateAvailable) return t("footer.updateAvailableShort");
    return t("footer.checkForUpdates");
  };

  const getUpdateStatusAction = () => {
    if (!updateChecksEnabled) return undefined;
    if (updatePhase === "restart-ready") return restartApp;
    if (updateAvailable && !isUpdating) return installUpdate;
    if (!isChecking && !isUpdating && !updateAvailable)
      return handleManualUpdateCheck;
    return undefined;
  };

  const isUpdateDisabled = !updateChecksEnabled || isChecking || isUpdating;
  const isUpdateClickable =
    (!isUpdateDisabled &&
      (updateAvailable || (!isChecking && !showUpToDate))) ||
    updatePhase === "restart-ready";

  return (
    <>
      {showPortableUpdateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h2 className="text-base font-semibold">
              {t("footer.portableUpdateTitle")}
            </h2>
            <p className="text-sm text-text/70">
              {t("footer.portableUpdateMessage")}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 text-sm rounded border border-border hover:bg-border/50 transition-colors"
                onClick={() => setShowPortableUpdateDialog(false)}
              >
                {t("common.close")}
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-logo-primary text-white hover:bg-logo-primary/80 transition-colors"
                onClick={() => {
                  openUrl("https://github.com/Melvynx/Parler/releases/latest");
                  setShowPortableUpdateDialog(false);
                }}
              >
                {t("footer.portableUpdateButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`flex items-center gap-3 ${className}`}>
        {isUpdateClickable ? (
          <button
            onClick={getUpdateStatusAction()}
            disabled={isUpdateDisabled}
            className={`transition-colors disabled:opacity-50 tabular-nums ${
              updateAvailable
                ? "text-logo-primary hover:text-logo-primary/80 font-medium"
                : "text-text/60 hover:text-text/80"
            }`}
          >
            {getUpdateStatusText()}
          </button>
        ) : (
          <span className="text-text/60 tabular-nums">
            {getUpdateStatusText()}
          </span>
        )}

        {updatePhase === "downloading" && downloadProgress > 0 && (
          <ProgressBar
            progress={[
              {
                id: "update",
                percentage: downloadProgress,
              },
            ]}
            size="large"
          />
        )}
      </div>
    </>
  );
};

export default UpdateChecker;
