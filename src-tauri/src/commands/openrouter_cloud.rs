use crate::settings::{self, PostProcessProvider};
use tauri::AppHandle;

fn openrouter_provider() -> PostProcessProvider {
    PostProcessProvider {
        id: "openrouter".to_string(),
        label: "OpenRouter".to_string(),
        base_url: "https://openrouter.ai/api/v1".to_string(),
        allow_base_url_edit: false,
        models_endpoint: Some("/models".to_string()),
        supports_structured_output: true,
    }
}

#[tauri::command]
#[specta::specta]
pub fn change_openrouter_cloud_api_key_setting(
    app: AppHandle,
    api_key: String,
) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.openrouter_cloud_api_key = if api_key.trim().is_empty() {
        None
    } else {
        Some(api_key)
    };
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn change_openrouter_cloud_model_setting(app: AppHandle, model: String) -> Result<(), String> {
    let mut settings = settings::get_settings(&app);
    settings.openrouter_cloud_model = model;
    settings::write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_openrouter_cloud_models(app: AppHandle) -> Result<Vec<String>, String> {
    let settings = settings::get_settings(&app);
    let api_key = settings
        .openrouter_cloud_api_key
        .unwrap_or_default()
        .trim()
        .to_string();

    if api_key.is_empty() {
        return Err("OpenRouter cloud API key is required".to_string());
    }

    crate::llm_client::fetch_models(&openrouter_provider(), api_key).await
}

#[tauri::command]
#[specta::specta]
pub async fn validate_openrouter_post_process(app: AppHandle) -> Result<String, String> {
    let settings = settings::get_settings(&app);
    let provider = settings
        .post_process_provider("openrouter")
        .cloned()
        .unwrap_or_else(openrouter_provider);
    let api_key = settings
        .post_process_api_keys
        .get("openrouter")
        .cloned()
        .unwrap_or_default();
    let model = settings
        .post_process_models
        .get("openrouter")
        .cloned()
        .unwrap_or_default();

    if api_key.trim().is_empty() {
        return Err("OpenRouter API key is required for post-processing".to_string());
    }
    if model.trim().is_empty() {
        return Err("OpenRouter model is required for post-processing".to_string());
    }

    let prompt = "Return exactly the word OK.".to_string();
    let response = crate::llm_client::send_chat_completion(&provider, api_key, &model, prompt)
        .await
        .map_err(|e| format!("OpenRouter post-process validation failed: {}", e))?;

    Ok(response.unwrap_or_else(|| "OK".to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn validate_openrouter_cloud_transcription(app: AppHandle) -> Result<String, String> {
    let settings = settings::get_settings(&app);
    let api_key = settings
        .openrouter_cloud_api_key
        .unwrap_or_default()
        .trim()
        .to_string();
    let model = settings.openrouter_cloud_model.trim().to_string();

    if api_key.is_empty() {
        return Err("OpenRouter cloud API key is required".to_string());
    }
    if model.is_empty() {
        return Err("OpenRouter cloud model is required".to_string());
    }

    // 500ms of silence at 16kHz for an end-to-end request validation.
    let probe_audio = vec![0.0f32; 8_000];
    let selected_language = settings.selected_language.clone();
    let transcript = crate::openrouter_client::transcribe_audio(
        &api_key,
        &model,
        &probe_audio,
        &selected_language,
    )
    .await
    .map_err(|e| format!("OpenRouter cloud validation failed: {}", e))?;

    Ok(transcript)
}
