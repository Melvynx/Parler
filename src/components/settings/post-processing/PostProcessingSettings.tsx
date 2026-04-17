import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";
import {
  Dropdown,
  SettingContainer,
  SettingsGroup,
  Textarea,
} from "@/components/ui";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";

export const PostProcessingSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    settings,
    refreshSettings,
    postProcessModelOptions,
    setPostProcessProvider,
    updatePostProcessBaseUrl,
    updatePostProcessApiKey,
    updatePostProcessModel,
    fetchPostProcessModels,
  } = useSettings();

  const providers = settings?.post_process_providers ?? [];
  const selectedProviderId = settings?.post_process_provider_id ?? "";
  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ?? null;
  const selectedPromptId = settings?.post_process_selected_prompt_id ?? null;
  const prompts = settings?.post_process_prompts ?? [];

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");

  const currentApiKey =
    settings?.post_process_api_keys?.[selectedProviderId] ?? "";
  const currentModel =
    settings?.post_process_models?.[selectedProviderId] ?? "";
  const availableModels = postProcessModelOptions[selectedProviderId] ?? [];

  const providerOptions = useMemo(
    () =>
      providers.map((provider) => ({
        value: provider.id,
        label: provider.label,
      })),
    [providers],
  );
  const promptOptions = useMemo(
    () => [
      ...prompts.map((prompt) => ({ value: prompt.id, label: prompt.name })),
      {
        value: "__new__",
        label: t("settings.postProcessing.prompts.createNew"),
      },
    ],
    [prompts, t],
  );
  const modelOptions = useMemo(
    () => availableModels.map((model) => ({ value: model, label: model })),
    [availableModels],
  );

  const activePrompt =
    prompts.find((prompt) => prompt.id === editingPromptId) ?? null;

  useEffect(() => {
    setApiKeyInput(currentApiKey);
  }, [currentApiKey, selectedProviderId]);

  useEffect(() => {
    setBaseUrlInput(selectedProvider?.base_url ?? "");
  }, [selectedProvider?.base_url]);

  useEffect(() => {
    setModelInput(currentModel);
  }, [currentModel, selectedProviderId]);

  useEffect(() => {
    if (!prompts.length) {
      setEditingPromptId(null);
      setPromptName("");
      setPromptText("");
      return;
    }

    const nextPromptId =
      selectedPromptId &&
      prompts.some((prompt) => prompt.id === selectedPromptId)
        ? selectedPromptId
        : prompts[0].id;

    setEditingPromptId(nextPromptId);
  }, [prompts, selectedPromptId]);

  useEffect(() => {
    if (!activePrompt) {
      setPromptName("");
      setPromptText("");
      return;
    }

    setPromptName(activePrompt.name);
    setPromptText(activePrompt.prompt);
  }, [activePrompt]);

  const handleProviderChange = useCallback(
    async (providerId: string) => {
      await setPostProcessProvider(providerId);
    },
    [setPostProcessProvider],
  );

  const handleApiKeyBlur = useCallback(async () => {
    if (!selectedProviderId || apiKeyInput === currentApiKey) return;
    await updatePostProcessApiKey(selectedProviderId, apiKeyInput.trim());
  }, [apiKeyInput, currentApiKey, selectedProviderId, updatePostProcessApiKey]);

  const handleBaseUrlBlur = useCallback(async () => {
    if (!selectedProviderId || baseUrlInput === selectedProvider?.base_url)
      return;
    await updatePostProcessBaseUrl(selectedProviderId, baseUrlInput.trim());
  }, [
    baseUrlInput,
    selectedProvider?.base_url,
    selectedProviderId,
    updatePostProcessBaseUrl,
  ]);

  const handleFetchModels = useCallback(async () => {
    if (!selectedProviderId) return;
    setIsFetchingModels(true);
    try {
      await fetchPostProcessModels(selectedProviderId);
    } finally {
      setIsFetchingModels(false);
    }
  }, [fetchPostProcessModels, selectedProviderId]);

  const handleModelSelect = useCallback(
    async (value: string) => {
      if (!selectedProviderId) return;
      await updatePostProcessModel(selectedProviderId, value);
    },
    [selectedProviderId, updatePostProcessModel],
  );

  const handleModelBlur = useCallback(async () => {
    if (!selectedProviderId || modelInput === currentModel) return;
    await updatePostProcessModel(selectedProviderId, modelInput.trim());
  }, [currentModel, modelInput, selectedProviderId, updatePostProcessModel]);

  const handlePromptChange = useCallback(
    async (value: string) => {
      if (value === "__new__") {
        setEditingPromptId(null);
        setPromptName("");
        setPromptText("");
        return;
      }

      setEditingPromptId(value);
      const result = await commands.setPostProcessSelectedPrompt(value);
      if (result.status === "ok") {
        await refreshSettings();
      }
    },
    [refreshSettings],
  );

  const handleSavePrompt = useCallback(async () => {
    const trimmedName = promptName.trim();
    const trimmedPrompt = promptText.trim();

    if (!trimmedName || !trimmedPrompt) return;

    if (editingPromptId) {
      const result = await commands.updatePostProcessPrompt(
        editingPromptId,
        trimmedName,
        trimmedPrompt,
      );
      if (result.status === "ok") {
        await refreshSettings();
      }
      return;
    }

    const result = await commands.addPostProcessPrompt(
      trimmedName,
      trimmedPrompt,
    );
    if (result.status === "ok") {
      const selectResult = await commands.setPostProcessSelectedPrompt(
        result.data.id,
      );
      if (selectResult.status === "ok") {
        await refreshSettings();
      }
    }
  }, [editingPromptId, promptName, promptText, refreshSettings]);

  const handleDeletePrompt = useCallback(async () => {
    if (!editingPromptId) return;
    const result = await commands.deletePostProcessPrompt(editingPromptId);
    if (result.status === "ok") {
      await refreshSettings();
    }
  }, [editingPromptId, refreshSettings]);

  const isAppleIntelligence = selectedProviderId === "apple_intelligence";
  const canEditBaseUrl = selectedProvider?.allow_base_url_edit ?? false;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.postProcessing.title")}>
        <SettingContainer
          title={t("settings.postProcessing.api.provider.title")}
          description={t("settings.postProcessing.api.provider.description")}
          descriptionMode="tooltip"
          grouped={true}
        >
          <Dropdown
            selectedValue={selectedProviderId || null}
            options={providerOptions}
            onSelect={handleProviderChange}
            placeholder={t("settings.postProcessing.api.provider.title")}
          />
        </SettingContainer>

        {selectedProvider && (
          <>
            {canEditBaseUrl && (
              <SettingContainer
                title={t("settings.postProcessing.api.baseUrl.title")}
                description={t(
                  "settings.postProcessing.api.baseUrl.description",
                )}
                descriptionMode="tooltip"
                grouped={true}
              >
                <Input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  onBlur={handleBaseUrlBlur}
                  placeholder={t(
                    "settings.postProcessing.api.baseUrl.placeholder",
                  )}
                  variant="compact"
                />
              </SettingContainer>
            )}

            {!isAppleIntelligence && (
              <SettingContainer
                title={t("settings.postProcessing.api.apiKey.title")}
                description={t(
                  "settings.postProcessing.api.apiKey.description",
                )}
                descriptionMode="tooltip"
                grouped={true}
              >
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onBlur={handleApiKeyBlur}
                  placeholder={t(
                    "settings.postProcessing.api.apiKey.placeholder",
                  )}
                  variant="compact"
                />
              </SettingContainer>
            )}

            <SettingContainer
              title={t("settings.postProcessing.api.model.title")}
              description={
                isAppleIntelligence
                  ? t("settings.postProcessing.api.model.descriptionApple")
                  : canEditBaseUrl
                    ? t("settings.postProcessing.api.model.descriptionCustom")
                    : t("settings.postProcessing.api.model.descriptionDefault")
              }
              descriptionMode="tooltip"
              grouped={true}
            >
              <div className="flex items-center gap-2">
                {modelOptions.length > 0 ? (
                  <Dropdown
                    selectedValue={currentModel || null}
                    options={modelOptions}
                    onSelect={handleModelSelect}
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
                    onBlur={handleModelBlur}
                    placeholder={t(
                      isAppleIntelligence
                        ? "settings.postProcessing.api.model.placeholderApple"
                        : "settings.postProcessing.api.model.placeholderNoOptions",
                    )}
                    variant="compact"
                    className="flex-1"
                  />
                )}
                {!isAppleIntelligence && !canEditBaseUrl && (
                  <button
                    onClick={handleFetchModels}
                    disabled={isFetchingModels || !selectedProviderId}
                    className="flex items-center justify-center h-8 w-8 rounded-md bg-mid-gray/10 hover:bg-mid-gray/20 transition-colors disabled:opacity-40"
                    title={t("settings.postProcessing.api.model.refreshModels")}
                  >
                    <RefreshCcw
                      className={`w-3.5 h-3.5 ${isFetchingModels ? "animate-spin" : ""}`}
                    />
                  </button>
                )}
              </div>
            </SettingContainer>
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title={t("settings.postProcessing.prompts.title")}>
        <SettingContainer
          title={t("settings.postProcessing.prompts.selectedPrompt.title")}
          description={t(
            "settings.postProcessing.prompts.selectedPrompt.description",
          )}
          descriptionMode="tooltip"
          grouped={true}
          layout="stacked"
        >
          <div className="space-y-3">
            <Dropdown
              selectedValue={editingPromptId}
              options={promptOptions}
              onSelect={handlePromptChange}
              placeholder={t("settings.postProcessing.prompts.selectPrompt")}
            />

            <Input
              type="text"
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              placeholder={t(
                "settings.postProcessing.prompts.promptLabelPlaceholder",
              )}
              variant="compact"
            />

            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={t(
                "settings.postProcessing.prompts.promptInstructionsPlaceholder",
              )}
            />

            <div className="flex gap-2">
              <Button
                onClick={handleSavePrompt}
                variant="primary"
                size="md"
                disabled={!promptName.trim() || !promptText.trim()}
              >
                {editingPromptId
                  ? t("settings.postProcessing.prompts.updatePrompt")
                  : t("settings.postProcessing.prompts.createPrompt")}
              </Button>
              {editingPromptId && (
                <Button
                  onClick={handleDeletePrompt}
                  variant="secondary"
                  size="md"
                >
                  {t("settings.postProcessing.prompts.deletePrompt")}
                </Button>
              )}
            </div>
          </div>
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
};
