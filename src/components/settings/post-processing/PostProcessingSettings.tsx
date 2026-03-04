import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";

import {
  Dropdown,
  SettingContainer,
  SettingsGroup,
  Textarea,
} from "@/components/ui";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { useSettings } from "../../../hooks/useSettings";

const PostProcessingActionsComponent: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, refreshSettings } = useSettings();
  const [editingAction, setEditingAction] = useState<{
    key: number;
    name: string;
    prompt: string;
    savedModelId: string;
    isNew: boolean;
  } | null>(null);

  const actions = getSetting("post_process_actions") || [];
  const savedModels = getSetting("saved_processing_models") || [];

  const modelDropdownOptions = [
    {
      value: "__default__",
      label: t("settings.postProcessing.actions.defaultModel"),
    },
    ...savedModels.map((m) => ({
      value: m.id,
      label: m.label,
    })),
  ];

  const usedKeys = new Set(actions.map((a) => a.key));
  const nextAvailableKey = Array.from({ length: 9 }, (_, i) => i + 1).find(
    (k) => !usedKeys.has(k),
  );

  const handleStartCreate = () => {
    if (!nextAvailableKey) return;
    setEditingAction({
      key: nextAvailableKey,
      name: "",
      prompt: "",
      savedModelId: "",
      isNew: true,
    });
  };

  const handleStartEdit = (action: {
    key: number;
    name: string;
    prompt: string;
    model?: string | null;
    provider_id?: string | null;
  }) => {
    let savedModelId = "";
    if (action.provider_id && action.model) {
      const id = `${action.provider_id}:${action.model}`;
      if (savedModels.some((m) => m.id === id)) {
        savedModelId = id;
      }
    }
    setEditingAction({
      key: action.key,
      name: action.name,
      prompt: action.prompt,
      savedModelId,
      isNew: false,
    });
  };

  const handleSave = async () => {
    if (
      !editingAction ||
      !editingAction.name.trim() ||
      !editingAction.prompt.trim()
    )
      return;

    try {
      let model: string | null = null;
      let providerId: string | null = null;
      if (editingAction.savedModelId) {
        const saved = savedModels.find(
          (m) => m.id === editingAction.savedModelId,
        );
        if (saved) {
          model = saved.model_id;
          providerId = saved.provider_id;
        }
      }
      if (editingAction.isNew) {
        await commands.addPostProcessAction(
          editingAction.key,
          editingAction.name.trim(),
          editingAction.prompt.trim(),
          model,
          providerId,
        );
      } else {
        await commands.updatePostProcessAction(
          editingAction.key,
          editingAction.name.trim(),
          editingAction.prompt.trim(),
          model,
          providerId,
        );
      }
      await refreshSettings();
      setEditingAction(null);
    } catch (error) {
      console.error("Failed to save action:", error);
    }
  };

  const handleDelete = async (key: number) => {
    try {
      await commands.deletePostProcessAction(key);
      await refreshSettings();
      if (editingAction?.key === key) {
        setEditingAction(null);
      }
    } catch (error) {
      console.error("Failed to delete action:", error);
    }
  };

  return (
    <SettingContainer
      title={t("settings.postProcessing.actions.title")}
      description={t("settings.postProcessing.actions.description")}
      descriptionMode="tooltip"
      layout="stacked"
      grouped={true}
    >
      <div className="space-y-3">
        {actions.length > 0 && (
          <div className="space-y-1">
            {[...actions]
              .sort((a, b) => a.key - b.key)
              .map((action) => (
                <div
                  key={action.key}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-mid-gray/5 cursor-pointer group"
                  onClick={() => handleStartEdit(action)}
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded bg-blue-500/15 text-blue-400 text-xs font-bold font-mono flex-shrink-0">
                    {action.key}
                  </span>
                  <span className="text-sm text-text flex-1 truncate">
                    {action.name}
                    {action.provider_id && action.model && (
                      <span className="text-xs text-mid-gray/60 ml-2">
                        {savedModels.find(
                          (m) =>
                            m.id === `${action.provider_id}:${action.model}`,
                        )?.label || action.model}
                      </span>
                    )}
                  </span>
                  <button
                    className="text-xs text-mid-gray/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(action.key);
                    }}
                  >
                    {t("settings.postProcessing.actions.delete")}
                  </button>
                </div>
              ))}
          </div>
        )}

        {actions.length === 0 && !editingAction && (
          <div className="p-3 bg-mid-gray/5 rounded-md border border-mid-gray/20">
            <p className="text-sm text-mid-gray">
              {t("settings.postProcessing.actions.createFirst")}
            </p>
          </div>
        )}

        {editingAction && (
          <div className="space-y-3 p-3 rounded-md border border-mid-gray/20 bg-mid-gray/5">
            <div className="flex gap-3">
              <div className="space-y-1 flex flex-col">
                <label className="text-sm font-semibold">
                  {t("settings.postProcessing.actions.key")}
                </label>
                <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-500/15 text-blue-400 text-sm font-bold font-mono">
                  {editingAction.key}
                </div>
              </div>
              <div className="space-y-1 flex flex-col flex-1">
                <label className="text-sm font-semibold">
                  {t("settings.postProcessing.actions.name")}
                </label>
                <Input
                  type="text"
                  value={editingAction.name}
                  onChange={(e) =>
                    setEditingAction({ ...editingAction, name: e.target.value })
                  }
                  placeholder={t(
                    "settings.postProcessing.actions.namePlaceholder",
                  )}
                  variant="compact"
                />
              </div>
            </div>

            <div className="space-y-1 flex flex-col">
              <label className="text-sm font-semibold">
                {t("settings.postProcessing.actions.prompt")}
              </label>
              <Textarea
                value={editingAction.prompt}
                onChange={(e) =>
                  setEditingAction({ ...editingAction, prompt: e.target.value })
                }
                placeholder={t(
                  "settings.postProcessing.actions.promptPlaceholder",
                )}
              />
              <p
                className="text-xs text-mid-gray/70"
                dangerouslySetInnerHTML={{
                  __html: t("settings.postProcessing.actions.promptTip"),
                }}
              />
            </div>

            <div className="space-y-1 flex flex-col">
              <label className="text-sm font-semibold">
                {t("settings.postProcessing.actions.model")}
              </label>
              <Dropdown
                selectedValue={editingAction.savedModelId || null}
                options={modelDropdownOptions}
                onSelect={(value) =>
                  setEditingAction({
                    ...editingAction,
                    savedModelId: value === "__default__" ? "" : value,
                  })
                }
                placeholder={t(
                  "settings.postProcessing.actions.modelPlaceholder",
                )}
              />
              <p className="text-xs text-mid-gray/70">
                {t("settings.postProcessing.actions.modelTip")}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                variant="primary"
                size="md"
                disabled={
                  !editingAction.name.trim() || !editingAction.prompt.trim()
                }
              >
                {t("settings.postProcessing.actions.save")}
              </Button>
              <Button
                onClick={() => setEditingAction(null)}
                variant="secondary"
                size="md"
              >
                {t("settings.postProcessing.actions.cancel")}
              </Button>
              {!editingAction.isNew && (
                <Button
                  onClick={() => handleDelete(editingAction.key)}
                  variant="secondary"
                  size="md"
                >
                  {t("settings.postProcessing.actions.delete")}
                </Button>
              )}
            </div>
          </div>
        )}

        {!editingAction && actions.length < 9 && (
          <Button onClick={handleStartCreate} variant="primary" size="md">
            {t("settings.postProcessing.actions.addAction")}
          </Button>
        )}

        {actions.length >= 9 && !editingAction && (
          <p className="text-xs text-mid-gray/60">
            {t("settings.postProcessing.actions.maxActionsReached")}
          </p>
        )}
      </div>
    </SettingContainer>
  );
};

export const PostProcessingActions = React.memo(PostProcessingActionsComponent);
PostProcessingActions.displayName = "PostProcessingActions";

const PostProcessingApiSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    getSetting,
    setPostProcessProvider,
    updatePostProcessApiKey,
    updatePostProcessBaseUrl,
    updatePostProcessModel,
    fetchPostProcessModels,
    postProcessModelOptions,
  } = useSettings();

  const providers = getSetting("post_process_providers") || [];
  const selectedProviderId =
    (getSetting("post_process_provider_id") as string | undefined) || "";
  const selectedProvider = providers.find((p) => p.id === selectedProviderId);
  const apiKeyMap = getSetting("post_process_api_keys") || {};
  const baseUrl = selectedProvider?.base_url || "";
  const modelMap = getSetting("post_process_models") || {};
  const selectedModel =
    (modelMap[selectedProviderId] as string | undefined) || "";
  const currentApiKey =
    (apiKeyMap[selectedProviderId] as string | undefined) || "";

  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [modelInput, setModelInput] = useState(selectedModel);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{
    type: "idle" | "success" | "error";
    text: string;
  }>({ type: "idle", text: "" });

  useEffect(() => {
    setApiKeyInput(currentApiKey);
  }, [currentApiKey, selectedProviderId]);

  useEffect(() => {
    setBaseUrlInput(baseUrl);
  }, [baseUrl, selectedProviderId]);

  useEffect(() => {
    setModelInput(selectedModel);
  }, [selectedModel, selectedProviderId]);

  const providerOptions = useMemo(
    () => providers.map((p) => ({ value: p.id, label: p.label })),
    [providers],
  );

  const availableModels = postProcessModelOptions[selectedProviderId] || [];
  const modelOptions = useMemo(
    () => availableModels.map((value) => ({ value, label: value })),
    [availableModels],
  );

  const handleProviderChange = async (providerId: string) => {
    setValidationMessage({ type: "idle", text: "" });
    await setPostProcessProvider(providerId);
  };

  const handleRefreshModels = async () => {
    if (!selectedProviderId) return;
    setValidationMessage({ type: "idle", text: "" });
    setIsFetchingModels(true);
    try {
      const models = await fetchPostProcessModels(selectedProviderId);
      setValidationMessage({
        type: "success",
        text: t("settings.openrouterCloud.modelsLoaded", {
          count: models.length,
        }),
      });
    } catch (error) {
      setValidationMessage({
        type: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestOpenRouter = async () => {
    setIsTestingOpenRouter(true);
    setValidationMessage({ type: "idle", text: "" });
    try {
      const result = await commands.validateOpenrouterPostProcess();
      if (result.status === "ok") {
        setValidationMessage({
          type: "success",
          text: t("settings.openrouterCloud.postProcessTestSuccess", {
            response: result.data,
          }),
        });
      } else {
        setValidationMessage({ type: "error", text: result.error });
      }
    } catch (error) {
      setValidationMessage({
        type: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  return (
    <SettingContainer
      title={t("settings.postProcessing.api.title")}
      description={t("settings.postProcessing.api.provider.description")}
      descriptionMode="tooltip"
      layout="stacked"
      grouped={true}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-semibold">
            {t("settings.postProcessing.api.provider.title")}
          </label>
          <Dropdown
            selectedValue={selectedProviderId || null}
            options={providerOptions}
            onSelect={handleProviderChange}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">
            {t("settings.postProcessing.api.apiKey.title")}
          </label>
          <Input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onBlur={() =>
              selectedProviderId &&
              updatePostProcessApiKey(selectedProviderId, apiKeyInput)
            }
            placeholder={t("settings.postProcessing.api.apiKey.placeholder")}
            variant="compact"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">
            {t("settings.postProcessing.api.baseUrl.title")}
          </label>
          <Input
            type="text"
            value={baseUrlInput}
            onChange={(e) => setBaseUrlInput(e.target.value)}
            onBlur={() =>
              selectedProvider?.allow_base_url_edit &&
              selectedProviderId &&
              updatePostProcessBaseUrl(selectedProviderId, baseUrlInput)
            }
            disabled={!selectedProvider?.allow_base_url_edit}
            placeholder={t("settings.postProcessing.api.baseUrl.placeholder")}
            variant="compact"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">
            {t("settings.postProcessing.api.model.title")}
          </label>
          <div className="flex items-center gap-2">
            {modelOptions.length > 0 ? (
              <Dropdown
                selectedValue={modelInput || null}
                options={modelOptions}
                onSelect={(value) => {
                  setModelInput(value);
                  if (selectedProviderId) {
                    updatePostProcessModel(selectedProviderId, value);
                  }
                }}
                placeholder={t(
                  "settings.postProcessing.api.model.placeholderWithOptions",
                )}
                className="flex-1"
              />
            ) : (
              <Input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onBlur={() =>
                  selectedProviderId &&
                  updatePostProcessModel(selectedProviderId, modelInput)
                }
                placeholder={t(
                  "settings.postProcessing.api.model.placeholderNoOptions",
                )}
                variant="compact"
                className="flex-1"
              />
            )}
            <Button
              onClick={handleRefreshModels}
              variant="secondary"
              size="sm"
              disabled={isFetchingModels || !selectedProviderId}
            >
              {isFetchingModels
                ? t("settings.openrouterCloud.testing")
                : t("settings.postProcessing.api.model.refreshModels")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            onClick={handleTestOpenRouter}
            variant="primary"
            size="sm"
            disabled={
              selectedProviderId !== "openrouter" || isTestingOpenRouter
            }
          >
            {isTestingOpenRouter
              ? t("settings.openrouterCloud.testing")
              : t("settings.openrouterCloud.testPostProcessButton")}
          </Button>
          {selectedProviderId !== "openrouter" && (
            <span className="text-xs text-mid-gray/70">
              {t("settings.openrouterCloud.testOpenRouterHint")}
            </span>
          )}
        </div>

        {validationMessage.type !== "idle" && (
          <p
            className={`text-xs ${
              validationMessage.type === "success"
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {validationMessage.text}
          </p>
        )}
      </div>
    </SettingContainer>
  );
};

export const PostProcessingSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.postProcessing.api.title")}>
        <PostProcessingApiSettings />
      </SettingsGroup>
      <SettingsGroup title={t("settings.postProcessing.actions.title")}>
        <PostProcessingActions />
      </SettingsGroup>
    </div>
  );
};
