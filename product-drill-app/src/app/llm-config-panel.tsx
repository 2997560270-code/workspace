"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLlmConfigs, LlmConfigApiError, saveLlmConfig, testLlmConnection } from "../lib/api/llm-config-client";
import { LLM_PROVIDER_PRESETS, providerName, type LlmConfigPublic } from "../lib/api/llm-config-schemas";

type Status = "idle" | "loading" | "saving" | "testing" | "error";

function providerBaseUrl(id: string): string {
  return LLM_PROVIDER_PRESETS.find((item) => item.id === id)?.baseUrl ?? "";
}

// 简化版：只需保存一个模型，并用「启用」开关作为模型切换。
export function LlmConfigPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [configs, setConfigs] = useState<LlmConfigPublic[]>([]);
  const [provider, setProvider] = useState("custom");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [enabled, setEnabled] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const active = configs[0] ?? null;

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const list = await fetchLlmConfigs();
      setConfigs(list);
      const first = list[0];
      if (first) {
        setProvider(first.provider);
        setBaseUrl(first.baseUrl);
        setModel(first.model);
        setTemperature(first.temperature);
        setEnabled(first.enabled);
        setHasApiKey(first.hasApiKey);
        setApiKeyMasked(first.apiKeyMasked ?? "");
      }
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof LlmConfigApiError ? error.message : "读取配置失败。");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function onProviderChange(next: string) {
    setProvider(next);
    const presetBase = providerBaseUrl(next);
    setBaseUrl((current) => (!current || current === providerBaseUrl(provider) ? presetBase : current));
  }

  const baseOk = /^https?:\/\//.test(baseUrl.trim());
  const modelOk = model.trim().length >= 1;
  const keyOk = apiKey.trim().length > 0 || hasApiKey;
  const canSave = baseOk && modelOk && keyOk && status !== "saving";
  const canTest = baseOk && modelOk && keyOk && status !== "testing";

  async function handleSave() {
    if (!canSave) return;
    setStatus("saving");
    setMessage("");
    try {
      const saved = await saveLlmConfig({
        provider: active?.provider ?? provider.trim(),
        label: providerName(provider),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        model: model.trim(),
        temperature,
        enabled
      });
      setConfigs([saved]);
      setApiKey("");
      setHasApiKey(true);
      setApiKeyMasked(saved.apiKeyMasked ?? "");
      setStatus("idle");
      setMessage("已保存模型配置，当前生效模型：" + saved.model);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof LlmConfigApiError ? error.message : "保存失败。");
    }
  }

  async function handleTest() {
    if (!canTest) return;
    setStatus("testing");
    setMessage("");
    try {
      const result = await testLlmConnection({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
        prompt: "请只回复：连接成功",
      });
      setStatus("idle");
      setMessage("连接成功，模型回复：" + result.reply + "（耗时 " + result.latencyMs + "ms）");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof LlmConfigApiError ? error.message : "连接测试失败。");
    }
  }

  return (
    <div className="settings-overlay" onMouseDown={onClose}>
      <div aria-label="模型设置" className="settings-drawer settings-drawer--slim" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-main">
          <div className="settings-main-header">
            <div>
              <h2>模型</h2>
              <p>填入各提供方的 API 密钥即可使用其模型。</p>
            </div>
            <button className="settings-close" onClick={onClose} type="button" aria-label="关闭">×</button>
          </div>

          {active ? (
            <p className="llm-current" data-testid="llm-current-model">当前模型：{active.label || providerName(active.provider)} · {active.model}{enabled ? "（已启用）" : "（已停用）"}</p>
          ) : (
            <p className="llm-current muted">还没有配置模型，填写下方信息并保存即可使用。</p>
          )}

          <div className="llm-form surface">
            <div className="feedback-field">
              <span className="detail-label">提供方</span>
              <select aria-label="提供方" onChange={(event) => onProviderChange(event.target.value)} value={provider}>
                {LLM_PROVIDER_PRESETS.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
              </select>
            </div>

            <div className="feedback-field">
              <label className="detail-label" htmlFor="llm-api-key">API 密钥</label>
              <input
                id="llm-api-key"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={hasApiKey ? "已保存（" + apiKeyMasked + "），留空则沿用" : "输入 API 密钥，或留空使用环境认证"}
                type="password"
                value={apiKey}
              />
            </div>

            <div className="feedback-field">
              <label className="detail-label" htmlFor="llm-model">模型名</label>
              <input
                id="llm-model"
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
                type="text"
                value={model}
              />
            </div>

            <div className="llm-collapse">
              <button className="llm-collapse-toggle" onClick={() => setShowAdvanced((value) => !value)} type="button">
                {showAdvanced ? "▾" : "▸"} 自定义设置
              </button>
              {showAdvanced ? (
                <div className="llm-advanced">
                  <div className="feedback-field">
                    <label className="detail-label" htmlFor="llm-base-url">Base URL</label>
                    <input
                      id="llm-base-url"
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="https://api.openai.com/v1"
                      type="text"
                      value={baseUrl}
                    />
                  </div>
                  <div className="feedback-field">
                    <span className="detail-label">温度（Temperature）</span>
                    <input
                      className="llm-temperature"
                      max={2}
                      min={0}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                      step={0.1}
                      type="range"
                      value={temperature}
                    />
                    <span className="feedback-limit">当前 {temperature.toFixed(1)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <label className="llm-enabled">
              <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
              启用该模型（作为当前使用模型）
            </label>

            {message ? (
              <p className={status === "error" ? "feedback-error" : "llm-success"} data-testid="llm-config-status" role="status">{message}</p>
            ) : null}

            <div className="feedback-actions">
              <button className="button button-primary" disabled={!canSave} onClick={handleSave} type="button">
                {status === "saving" ? "保存中…" : "保存"}
              </button>
              <button className="button button-secondary" disabled={!canTest} onClick={handleTest} type="button">
                {status === "testing" ? "测试中…" : "测试连接"}
              </button>
              <button className="text-button" onClick={onClose} type="button">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}