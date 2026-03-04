use crate::managers::history::{HistoryEntry, HistoryManager};
use crate::managers::transcription::TranscriptionManager;
use std::sync::Arc;
use tauri::{AppHandle, State};

fn path_to_string(path: &std::path::Path) -> Result<String, String> {
    path.to_str()
        .ok_or_else(|| "Invalid file path".to_string())
        .map(|s| s.to_string())
}

fn parse_recording_retention_period(
    period: &str,
) -> Result<crate::settings::RecordingRetentionPeriod, String> {
    use crate::settings::RecordingRetentionPeriod;

    match period {
        "never" => Ok(RecordingRetentionPeriod::Never),
        "preserve_limit" => Ok(RecordingRetentionPeriod::PreserveLimit),
        "days3" => Ok(RecordingRetentionPeriod::Days3),
        "weeks2" => Ok(RecordingRetentionPeriod::Weeks2),
        "months3" => Ok(RecordingRetentionPeriod::Months3),
        _ => Err(format!("Invalid retention period: {}", period)),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_history_entries(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
) -> Result<Vec<HistoryEntry>, String> {
    history_manager
        .get_history_entries()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_history_entry_saved(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .toggle_saved_status(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_audio_file_path(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    file_name: String,
) -> Result<String, String> {
    let path = history_manager
        .get_audio_file_path(&file_name)
        .map_err(|e| e.to_string())?;
    path_to_string(&path)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_history_entry(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    id: i64,
) -> Result<(), String> {
    history_manager
        .delete_entry(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_history_limit(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    limit: usize,
) -> Result<(), String> {
    let mut settings = crate::settings::get_settings(&app);
    settings.history_limit = limit;
    crate::settings::write_settings(&app, settings);

    history_manager
        .cleanup_old_entries()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn reprocess_history_entry(
    _app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
    id: i64,
    model_id: String,
) -> Result<String, String> {
    let entry = history_manager
        .get_entry_by_id(id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "History entry not found".to_string())?;

    let audio_path = history_manager
        .get_audio_file_path(&entry.file_name)
        .map_err(|e| e.to_string())?;
    if !audio_path.exists() {
        return Err("Audio file not found".to_string());
    }

    let samples = crate::audio_toolkit::load_wav_file(&audio_path).map_err(|e| e.to_string())?;

    let previous_model = transcription_manager.get_current_model();

    transcription_manager
        .load_model(&model_id)
        .map_err(|e| e.to_string())?;

    let new_text = transcription_manager
        .transcribe(samples)
        .map_err(|e| e.to_string())?;

    history_manager
        .update_transcription_text(id, &new_text)
        .map_err(|e| e.to_string())?;

    if let Some(prev_id) = previous_model {
        if prev_id != model_id {
            let _ = transcription_manager.load_model(&prev_id);
        }
    }

    Ok(new_text)
}

#[tauri::command]
#[specta::specta]
pub async fn update_recording_retention_period(
    app: AppHandle,
    history_manager: State<'_, Arc<HistoryManager>>,
    period: String,
) -> Result<(), String> {
    let retention_period = parse_recording_retention_period(period.as_str())?;

    let mut settings = crate::settings::get_settings(&app);
    settings.recording_retention_period = retention_period;
    crate::settings::write_settings(&app, settings);

    history_manager
        .cleanup_old_entries()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_recording_retention_period_accepts_valid_values() {
        assert!(matches!(
            parse_recording_retention_period("never"),
            Ok(crate::settings::RecordingRetentionPeriod::Never)
        ));
        assert!(matches!(
            parse_recording_retention_period("preserve_limit"),
            Ok(crate::settings::RecordingRetentionPeriod::PreserveLimit)
        ));
        assert!(matches!(
            parse_recording_retention_period("days3"),
            Ok(crate::settings::RecordingRetentionPeriod::Days3)
        ));
        assert!(matches!(
            parse_recording_retention_period("weeks2"),
            Ok(crate::settings::RecordingRetentionPeriod::Weeks2)
        ));
        assert!(matches!(
            parse_recording_retention_period("months3"),
            Ok(crate::settings::RecordingRetentionPeriod::Months3)
        ));
    }

    #[test]
    fn parse_recording_retention_period_rejects_invalid_value() {
        assert_eq!(
            parse_recording_retention_period("invalid"),
            Err("Invalid retention period: invalid".to_string())
        );
    }

    #[test]
    fn path_to_string_returns_string_for_valid_utf8_path() {
        let path = std::path::Path::new("/tmp/file.wav");
        assert_eq!(path_to_string(path), Ok("/tmp/file.wav".to_string()));
    }

    #[cfg(unix)]
    #[test]
    fn path_to_string_rejects_non_utf8_path() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;

        let non_utf8 = OsString::from_vec(vec![0x66, 0x6f, 0x80]);
        let path = std::path::PathBuf::from(non_utf8);
        assert_eq!(path_to_string(&path), Err("Invalid file path".to_string()));
    }
}
