use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SizedSample};
use std::error::Error;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    if let Err(err) = run() {
        eprintln!("[audio-probe] ERROR: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    println!("[audio-probe] starting");
    print_environment();

    let host = select_host();
    let host_name = host.id().name();
    println!("[audio-probe] selected host: {host_name}");

    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok())
        .unwrap_or_else(|| "<none>".to_string());

    let devices: Vec<cpal::Device> = host.input_devices()?.collect();
    println!("[audio-probe] input devices: {}", devices.len());

    for (idx, device) in devices.iter().enumerate() {
        let name = device.name().unwrap_or_else(|_| "Unknown".to_string());
        let is_default = name == default_name;
        println!(
            "  - [{}] {}{}",
            idx,
            name,
            if is_default { " (default)" } else { "" }
        );
    }

    let device = host
        .default_input_device()
        .or_else(|| devices.first().cloned())
        .ok_or_else(|| "No input device found".to_string())?;

    let device_name = device.name().unwrap_or_else(|_| "Unknown".to_string());
    let config = device.default_input_config()?;

    println!("[audio-probe] testing device: {device_name}");
    println!(
        "[audio-probe] stream config: sample_rate={} channels={} format={:?}",
        config.sample_rate().0,
        config.channels(),
        config.sample_format()
    );

    let sample_count = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(Mutex::new(0.0_f32));

    let stream = match config.sample_format() {
        cpal::SampleFormat::I8 => {
            build_stream::<i8>(&device, &config, sample_count.clone(), peak.clone())?
        }
        cpal::SampleFormat::I16 => {
            build_stream::<i16>(&device, &config, sample_count.clone(), peak.clone())?
        }
        cpal::SampleFormat::I32 => {
            build_stream::<i32>(&device, &config, sample_count.clone(), peak.clone())?
        }
        cpal::SampleFormat::U8 => {
            build_stream::<u8>(&device, &config, sample_count.clone(), peak.clone())?
        }
        cpal::SampleFormat::U16 => {
            build_stream::<u16>(&device, &config, sample_count.clone(), peak.clone())?
        }
        cpal::SampleFormat::U32 => {
            build_stream::<u32>(&device, &config, sample_count.clone(), peak.clone())?
        }
        cpal::SampleFormat::F32 => {
            build_stream::<f32>(&device, &config, sample_count.clone(), peak.clone())?
        }
        other => {
            return Err(format!("Unsupported sample format: {other:?}").into());
        }
    };

    stream.play()?;
    println!("[audio-probe] listening for 3 seconds... speak now");
    thread::sleep(Duration::from_secs(3));
    drop(stream);

    let total_samples = sample_count.load(Ordering::Relaxed);
    let max_peak = *peak.lock().map_err(|_| "Failed to lock peak")?;

    println!("[audio-probe] captured samples: {total_samples}");
    println!("[audio-probe] peak level: {max_peak:.6}");

    if total_samples == 0 {
        return Err("Stream opened but no samples were captured".into());
    }

    println!("[audio-probe] success");
    Ok(())
}

fn print_environment() {
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "<unset>".to_string());
    let session_desktop =
        std::env::var("XDG_SESSION_DESKTOP").unwrap_or_else(|_| "<unset>".to_string());
    let current_desktop =
        std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_else(|_| "<unset>".to_string());
    let wayland_display =
        std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "<unset>".to_string());

    println!("[audio-probe] env XDG_SESSION_TYPE={session_type}");
    println!("[audio-probe] env XDG_SESSION_DESKTOP={session_desktop}");
    println!("[audio-probe] env XDG_CURRENT_DESKTOP={current_desktop}");
    println!("[audio-probe] env WAYLAND_DISPLAY={wayland_display}");

    let hosts = cpal::available_hosts();
    println!("[audio-probe] available CPAL hosts: {}", hosts.len());
    for host_id in hosts {
        println!("  - {}", host_id.name());
    }
}

fn select_host() -> cpal::Host {
    #[cfg(target_os = "linux")]
    {
        // Match app behavior: prefer ALSA host on Linux.
        return cpal::host_from_id(cpal::HostId::Alsa).unwrap_or_else(|_| cpal::default_host());
    }

    #[cfg(not(target_os = "linux"))]
    {
        cpal::default_host()
    }
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    sample_count: Arc<AtomicUsize>,
    peak: Arc<Mutex<f32>>,
) -> Result<cpal::Stream, cpal::BuildStreamError>
where
    T: Sample + SizedSample + Send + 'static,
    f32: FromSample<T>,
{
    let channels = usize::from(config.channels());
    let stream_config: cpal::StreamConfig = config.clone().into();

    device.build_input_stream(
        &stream_config,
        move |data: &[T], _| {
            sample_count.fetch_add(data.len(), Ordering::Relaxed);

            let mut local_peak = 0.0_f32;
            for frame in data.chunks(channels.max(1)) {
                for s in frame {
                    let v = f32::from_sample(*s).abs();
                    if v > local_peak {
                        local_peak = v;
                    }
                }
            }

            if let Ok(mut peak_guard) = peak.lock() {
                if local_peak > *peak_guard {
                    *peak_guard = local_peak;
                }
            }
        },
        move |err| {
            eprintln!("[audio-probe] stream error: {err}");
        },
        None,
    )
}
