"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

export function VoiceInputButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "unsupported" | "error">("idle");

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
    recognition.onerror = () => setStatus("error");
    recognition.onend = () => setStatus("idle");
    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  }

  const label = status === "listening" ? "停止录音" : "语音输入";
  return <button aria-label={label} className={`voice-input-button${status === "listening" ? " active" : ""}`} disabled={disabled} onClick={toggle} title={status === "unsupported" ? "当前浏览器不支持语音识别，请直接输入文字" : status === "error" ? "语音识别失败，请重试或直接输入文字" : label} type="button"><span aria-hidden="true">{status === "listening" ? "■" : "●"}</span>{status === "unsupported" ? "浏览器不支持" : status === "error" ? "重试语音" : label}</button>;
}
