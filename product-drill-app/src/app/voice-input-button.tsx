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
};

type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

type VoiceStatus = "idle" | "listening" | "unsupported" | "error";

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

  useEffect(() => () => recognitionRef.current?.stop(), []);

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
    recognition.onerror = (event) => {
      setErrorDetail(ERROR_MESSAGES[event?.error ?? ""] ?? "语音识别失败");
      setStatus("error");
    };
    // onend 会在 onerror 之后触发：若已进入错误/不支持状态，保留提示而不是悄悄复位。
    recognition.onend = () => setStatus((current) => (current === "listening" ? "idle" : current));
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
