import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCcw } from "lucide-react";
import { useSettings } from "../../../hooks/useSettings";
import { commands } from "@/bindings";
import { SettingContainer } from "../../ui/SettingContainer";
import { Dropdown } from "../../ui/Dropdown";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";

export const OpenRouterCloudSettings: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();

  const apiKey = (
    (getSetting("openrouter_cloud_api_key") as string | null | undefined) ?? ""
  ).toString();
  const currentModel = (
    (getSetting("openrouter_cloud_model") as string | undefined) ?? ""
  ).trim();

  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModel, setLocalModel] = useState(currentModel);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  React.useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  React.useEffect(() => {
    setLocalModel(currentModel);
  }, [currentModel]);

  const handleApiKeyBlur = () => {
    if (localApiKey !== apiKey) {
      updateSetting("openrouter_cloud_api_key", localApiKey || null);
    }
  };

  const handleModelBlur = () => {
    if (localModel !== currentModel) {
      updateSetting("openrouter_cloud_model", localModel.trim());
    }
  };

  const handleRefreshModels = async () => {
    setIsFetchingModels(true);
    setFeedback({ type: "idle", message: "" });
    try {
      const result = await commands.fetchOpenrouterCloudModels();
      if (result.status === "ok") {
        setModelOptions(result.data);
        setFeedback({
          type: "success",
          message: t("settings.openrouterCloud.modelsLoaded", {
            count: result.data.length,
          }),
        });
      } else {
        setFeedback({ type: "error", message: result.error });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestCloud = async () => {
    setIsTesting(true);
    setFeedback({ type: "idle", message: "" });
    try {
      const result = await commands.validateOpenrouterCloudTranscription();
      if (result.status === "ok") {
        const transcript = result.data.trim();
        setFeedback({
          type: "success",
          message: transcript
            ? t("settings.openrouterCloud.testSuccessWithTranscript", {
                transcript,
              })
            : t("settings.openrouterCloud.testSuccess"),
        });
      } else {
        setFeedback({ type: "error", message: result.error });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const options = modelOptions.map((value) => ({ value, label: value }));

  return (
    <>
      <SettingContainer
        title={t("settings.openrouterCloud.apiKey")}
        description={t("settings.openrouterCloud.description")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <div className="flex items-center justify-end gap-2">
          <Input
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            onBlur={handleApiKeyBlur}
            placeholder={t("settings.openrouterCloud.apiKeyPlaceholder")}
            variant="compact"
            className="flex-1 w-[320px]"
          />
        </div>
      </SettingContainer>

      <SettingContainer
        title={t("settings.openrouterCloud.model")}
        description={t("settings.openrouterCloud.modelDescription")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <div className="flex items-center justify-end gap-2 w-[320px]">
          {options.length > 0 ? (
            <Dropdown
              options={options}
              selectedValue={localModel}
              onSelect={(value) => {
                setLocalModel(value);
                updateSetting("openrouter_cloud_model", value);
              }}
              className="flex-1"
            />
          ) : (
            <Input
              type="text"
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              onBlur={handleModelBlur}
              placeholder={t("settings.openrouterCloud.modelPlaceholder")}
              variant="compact"
              className="flex-1"
            />
          )}
          <button
            onClick={handleRefreshModels}
            disabled={isFetchingModels}
            className="flex items-center justify-center h-8 w-8 rounded-md bg-mid-gray/10 hover:bg-mid-gray/20 transition-colors disabled:opacity-40"
            title={t("settings.openrouterCloud.refreshModels")}
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 ${isFetchingModels ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </SettingContainer>

      <SettingContainer
        title={t("settings.openrouterCloud.testTitle")}
        description={t("settings.openrouterCloud.testDescription")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={handleTestCloud}
            variant="primary"
            size="sm"
            disabled={isTesting}
          >
            {isTesting
              ? t("settings.openrouterCloud.testing")
              : t("settings.openrouterCloud.testButton")}
          </Button>
          {feedback.type !== "idle" && (
            <div
              className={`text-xs max-w-[360px] text-right ${
                feedback.type === "success" ? "text-green-500" : "text-red-500"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </div>
      </SettingContainer>
    </>
  );
};
