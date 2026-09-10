"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

type VoiceStatus = "idle" | "listening" | "unsupported" | "error";

// RT-007：识别报错后必须主动释放麦克风，否则标签页会一直显示「正在录音」。
// abort() 比 stop() 更快断开音频采集，但只有运行中的识别器才能调用，
// 因此统一走这个容错封装，并在失败时退回 stop()。同一个识别器只释放一次
// （onerror 与 onend 可能先后触发，卸载清理也可能再调一次）。
const releasedRecognitions = new WeakSet<SpeechRecognitionLike>();

function releaseRecognition(recognition: SpeechRecognitionLike | null): void {
  if (!recognition || releasedRecognitions.has(recognition)) return;
  releasedRecognitions.add(recognition);
  try {
    recognition.abort();
  } catch {
    try {
      recognition.stop();
    } catch {
      // 识别器已经结束，无需再释放。
    }
  }
}

// 失败原因对用户不可见是 FB-002 的核心问题：这里把浏览器错误码翻译成人话，
// 并始终保留文字输入路径（需求 4.5）。
const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许后重试",
  "service-not-allowed": "当前环境不提供语音识别服务",
  "no-speech": "没有检测到语音，请靠近麦克风再说",
  "audio-capture": "没有找到可用的麦克风",
  network: "Chrome 语音识别需将音频上传到云端识别服务，当前网络无法访问该服务"
};

export function VoiceInputButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorDetail, setErrorDetail] = useState("");

  // RT-007：卸载时也要真正释放设备，stop() 在 network 错误态下不足以断开采集。
  useEffect(() => () => releaseRecognition(recognitionRef.current), []);

  function toggle() {
    if (disabled) return;
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("unsupported");
      setErrorDetail("当前浏览器不支持语音识别");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? "").join("").trim();
      if (transcript) onTranscript(transcript);
    };
    // RT-007：network 错误下 Chrome 可能不触发 onend，必须在这里主动 abort()，
    // 否则提示「用不了」的同时麦克风仍在采集（标签页持续显示录音图标）。
    recognition.onerror = (event) => {
      setErrorDetail(ERROR_MESSAGES[event?.error ?? ""] ?? "语音识别失败");
      setStatus("error");
      releaseRecognition(recognition);
      recognitionRef.current = null;
    };
    // onend 会在 onerror 之后触发：若已进入错误/不支持状态，保留提示而不是悄悄复位。
    // RT-007：同时兜底释放，保证任何结束路径都不残留设备占用。
    recognition.onend = () => {
      releaseRecognition(recognition);
      setStatus((current) => (current === "listening" ? "idle" : current));
    };
    recognitionRef.current = recognition;
    setErrorDetail("");
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      // start() 在麦克风不可用等情况下会直接抛错，必须转成可见提示。
      setErrorDetail("无法启动语音识别");
      setStatus("error");
    }
  }

  const label = status === "listening" ? "停止录音" : "语音输入";
  const notice = status === "unsupported"
    ? `${errorDetail}，请直接输入文字。`
    : status === "error"
      ? `${errorDetail}，可重试或直接输入文字。`
      : "";

  return (
    <span className="voice-input-wrap">
      <button
        aria-label={label}
        className={`voice-input-button${status === "listening" ? " active" : ""}`}
        disabled={disabled}
        onClick={toggle}
        title={notice || label}
        type="button"
      >
        <span aria-hidden="true">{status === "listening" ? "■" : "●"}</span>
        {status === "unsupported" ? "浏览器不支持" : status === "error" ? "重试语音" : label}
      </button>
      {notice ? (
        <p className="voice-input-notice" data-testid="voice-input-notice" role="alert">{notice}</p>
      ) : null}
    </span>
  );
}
