use anyhow::Result;
use base64::Engine;
use hound::{WavSpec, WavWriter};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, REFERER, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::io::Cursor;

const OPENROUTER_API_BASE: &str = "https://openrouter.ai/api/v1";

#[derive(Debug, Serialize)]
struct InputAudio {
    data: String,
    format: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
enum UserContentPart {
    Text { text: String },
    InputAudio { input_audio: InputAudio },
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: Vec<UserContentPart>,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Debug, Deserialize)]
struct ChatMessageResponse {
    content: Option<serde_json::Value>,
}

fn encode_samples_to_wav(samples: &[f32]) -> Result<Vec<u8>> {
    let spec = WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut buffer = Vec::new();
    {
        let cursor = Cursor::new(&mut buffer);
        let mut writer = WavWriter::new(cursor, spec)?;
        for sample in samples {
            let sample_i16 = (sample * i16::MAX as f32) as i16;
            writer.write_sample(sample_i16)?;
        }
        writer.finalize()?;
    }

    Ok(buffer)
}

fn parse_message_content(value: &serde_json::Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    let array = value.as_array()?;
    let mut segments = Vec::new();
    for part in array {
        if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                segments.push(trimmed.to_string());
            }
        }
    }

    if segments.is_empty() {
        None
    } else {
        Some(segments.join("\n"))
    }
}

fn build_transcription_request(model: &str, audio_base64: String) -> ChatCompletionRequest {
    ChatCompletionRequest {
        model: model.to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: vec![
                UserContentPart::Text {
                    text: "Transcribe this audio and return only the transcript text.".to_string(),
                },
                UserContentPart::InputAudio {
                    input_audio: InputAudio {
                        data: audio_base64,
                        format: "wav".to_string(),
                    },
                },
            ],
        }],
    }
}

fn maybe_model_incompatible_error(model: &str, error_body: &str) -> Option<String> {
    let normalized = error_body.to_lowercase();
    let mentions_audio = normalized.contains("audio") || normalized.contains("input_audio");
    let unsupported = normalized.contains("not support")
        || normalized.contains("unsupported")
        || normalized.contains("invalid content")
        || normalized.contains("not available");
    if mentions_audio && unsupported {
        return Some(format!(
            "Model '{}' does not appear to support audio input on OpenRouter. Choose an audio-capable model.",
            model
        ));
    }
    None
}

pub async fn transcribe_audio(api_key: &str, model: &str, audio_samples: &[f32]) -> Result<String> {
    if api_key.trim().is_empty() {
        return Err(anyhow::anyhow!(
            "OpenRouter cloud API key is not configured"
        ));
    }
    if model.trim().is_empty() {
        return Err(anyhow::anyhow!("OpenRouter cloud model is not configured"));
    }

    let wav_bytes = encode_samples_to_wav(audio_samples)?;
    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&wav_bytes);

    let request = build_transcription_request(model, audio_base64);

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| anyhow::anyhow!("Invalid API key header value: {}", e))?,
    );
    headers.insert(
        REFERER,
        HeaderValue::from_static("https://github.com/lucas-allard/Parlons"),
    );
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("ParlerLucas/1.0 (+https://github.com/lucas-allard/Parlons)"),
    );
    headers.insert("X-Title", HeaderValue::from_static("Parler Lucas"));

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", OPENROUTER_API_BASE))
        .headers(headers)
        .json(&request)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("OpenRouter request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read error response".to_string());
        if let Some(msg) = maybe_model_incompatible_error(model, &error_text) {
            return Err(anyhow::anyhow!(msg));
        }
        return Err(anyhow::anyhow!(
            "OpenRouter API error ({}): {}",
            status,
            error_text
        ));
    }

    let completion: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to parse OpenRouter response: {}", e))?;

    let content = completion
        .choices
        .first()
        .and_then(|c| c.message.content.as_ref())
        .and_then(parse_message_content)
        .unwrap_or_default();

    Ok(content)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_string_content() {
        let value = json!("hello world");
        assert_eq!(
            parse_message_content(&value),
            Some("hello world".to_string())
        );
    }

    #[test]
    fn parses_array_content() {
        let value = json!([
          {"type": "text", "text": "line one"},
          {"type": "output_text", "text": "line two"}
        ]);
        assert_eq!(
            parse_message_content(&value),
            Some("line one\nline two".to_string())
        );
    }

    #[test]
    fn ignores_empty_content() {
        let value = json!([]);
        assert_eq!(parse_message_content(&value), None);
    }

    #[test]
    fn builds_transcription_request_with_audio_part() {
        let request =
            build_transcription_request("openai/gpt-4o-mini-transcribe", "abc".to_string());
        assert_eq!(request.model, "openai/gpt-4o-mini-transcribe");
        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.messages[0].content.len(), 2);
        match &request.messages[0].content[1] {
            UserContentPart::InputAudio { input_audio } => {
                assert_eq!(input_audio.data, "abc");
                assert_eq!(input_audio.format, "wav");
            }
            _ => panic!("Expected input_audio content part"),
        }
    }

    #[test]
    fn detects_model_audio_incompatibility() {
        let err =
            maybe_model_incompatible_error("foo/bar", "input_audio is unsupported for this model");
        assert!(err.is_some());
    }

    #[test]
    fn ignores_non_audio_errors_for_compatibility_detection() {
        let err = maybe_model_incompatible_error("foo/bar", "rate limit exceeded");
        assert!(err.is_none());
    }
}
