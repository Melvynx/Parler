import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface PostProcessingToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const PostProcessingToggle: React.FC<PostProcessingToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("post_process_enabled") || false;
    const actions = getSetting("post_process_actions") || [];
    const defaultActionKey = getSetting("default_post_process_action_key");

    return (
      <div
        className={`space-y-4 ${
          grouped ? "p-4 bg-base-200/50 rounded-box border border-base-300" : ""
        }`}
      >
        <ToggleSwitch
          checked={enabled}
          onChange={(enabled) => updateSetting("post_process_enabled", enabled)}
          isUpdating={isUpdating("post_process_enabled")}
          label={t("settings.debug.postProcessingToggle.label")}
          description={t("settings.debug.postProcessingToggle.description")}
          descriptionMode={descriptionMode}
          grouped={false}
        />

        {enabled && actions.length > 0 && (
          <div className="pl-6 pt-2 border-l-2 border-base-300 ml-2">
            <label className="form-control w-full max-w-xs">
              <div className="label pt-0">
                <span className="label-text-alt text-base-content/70">
                  {t("settings.postProcessing.actions.defaultActionLabel", {
                    defaultValue: "Default action (optional)",
                  })}
                </span>
              </div>
              <select
                className="select select-bordered select-sm w-full"
                value={defaultActionKey ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSetting(
                    "default_post_process_action_key",
                    val ? parseInt(val, 10) : null,
                  );
                }}
                disabled={isUpdating("default_post_process_action_key")}
              >
                <option value="">
                  {t("settings.postProcessing.actions.noDefaultAction", {
                    defaultValue: "No default action",
                  })}
                </option>
                {actions.map((action) => (
                  <option key={action.key} value={action.key}>
                    {t("settings.postProcessing.actions.defaultActionOption", {
                      key: action.key,
                      name: action.name,
                      defaultValue: "Key {{key}} - {{name}}",
                    })}
                  </option>
                ))}
              </select>
            </label>
            {isUpdating("default_post_process_action_key") && (
              <span className="loading loading-spinner loading-xs ml-2 align-middle text-primary"></span>
            )}
          </div>
        )}
      </div>
    );
  });
