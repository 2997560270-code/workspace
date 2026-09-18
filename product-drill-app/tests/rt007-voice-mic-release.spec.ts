import { expect, test, type Page } from "@playwright/test";
import { enterApp } from "./e2e-helpers";

/**
 * RT-007 模拟测试：语音识别报错后必须释放麦克风。
 *
 * 浏览器里无法真的开麦克风，这里用 addInitScript 注入一个受控的
 * webkitSpeechRecognition 替身，把「是否仍在录音」「是否被 abort/stop 释放」
 * 记到 window.__voiceProbe 上，再驱动真实 UI 走一遍：
 * 开始录音 → 触发 network 错误 → 检查设备是否已被释放。
 */

type VoiceProbe = { started: number; stopped: number; aborted: number; recording: boolean; instances: number };

async function installFakeRecognition(page: Page) {
  await page.addInitScript(() => {
    const probe = { started: 0, stopped: 0, aborted: 0, recording: false, instances: 0 };
    (window as unknown as { __voiceProbe: VoiceProbe }).__voiceProbe = probe;
    const instances: unknown[] = [];
    (window as unknown as { __voiceInstances: unknown[] }).__voiceInstances = instances;

    class FakeSpeechRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: unknown = null;
      onerror: ((event?: { error?: string }) => void) | null = null;
      onend: (() => void) | null = null;
      state = "idle";

      constructor() {
        probe.instances += 1;
        instances.push(this);
      }

      start() {
        this.state = "recording";
        probe.started += 1;
        probe.recording = true;
      }

      stop() {
        probe.stopped += 1;
        if (this.state === "recording") {
          this.state = "ended";
          probe.recording = false;
        }
      }

      abort() {
        probe.aborted += 1;
        this.state = "ended";
        probe.recording = false;
      }
    }

    const target = window as unknown as Record<string, unknown>;
    target.SpeechRecognition = FakeSpeechRecognition;
    target.webkitSpeechRecognition = FakeSpeechRecognition;
  });
}

const readProbe = (page: Page) => page.evaluate(() => (window as unknown as { __voiceProbe: VoiceProbe }).__voiceProbe);

/** 进入训练对话，让语音输入按钮出现在「你的追问」输入框旁 */
async function openComposer(page: Page) {
  await enterApp(page);
  await page.getByTestId("start-today-training").click();
  await page.getByRole("button", { name: "语音输入", exact: true }).waitFor();
}

/** 触发一次 network 错误（模拟 Chrome 云端识别不可达） */
async function fireNetworkError(page: Page) {
  await page.evaluate(() => {
    const instances = (window as unknown as { __voiceInstances: Array<{ onerror?: ((event?: { error?: string }) => void) | null }> }).__voiceInstances;
    instances.at(-1)?.onerror?.({ error: "network" });
  });
}

test("RT-007 语音识别报错后立即释放麦克风", async ({ page }) => {
  await installFakeRecognition(page);
  await openComposer(page);

  await page.getByRole("button", { name: "语音输入", exact: true }).click();

  // 录音已开始：麦克风处于占用状态
  await expect.poll(async () => (await readProbe(page)).started).toBe(1);
  await expect.poll(async () => (await readProbe(page)).recording).toBe(true);

  await fireNetworkError(page);

  // 提示文案仍然必须生效（原有行为不能回退）
  await expect(page.getByTestId("voice-input-notice")).toContainText("Chrome 语音识别需将音频上传到云端识别服务");

  // 核心断言：报错后必须主动释放麦克风
  await expect.poll(async () => (await readProbe(page)).aborted, {
    message: "onerror 必须调用 abort() 释放麦克风"
  }).toBeGreaterThan(0);
  await expect.poll(async () => (await readProbe(page)).recording, {
    message: "报错后不应继续占用麦克风"
  }).toBe(false);
});

test("RT-007 报错后重试使用新的识别器，旧识别器不会继续占用", async ({ page }) => {
  await installFakeRecognition(page);
  await openComposer(page);

  await page.getByRole("button", { name: "语音输入", exact: true }).click();
  await fireNetworkError(page);
  await expect(page.getByTestId("voice-input-notice")).toBeVisible();

  // 错误态下按钮正文变为「重试语音」（无障碍名仍是 aria-label 的「语音输入」），再次点击应重新开始并新建识别器
  const retry = page.getByRole("button", { name: "语音输入", exact: true });
  await expect(retry).toContainText("重试语音");
  await retry.click();
  await expect.poll(async () => (await readProbe(page)).instances).toBe(2);
  await expect.poll(async () => (await readProbe(page)).started).toBe(2);
  await expect.poll(async () => (await readProbe(page)).recording).toBe(true);
});
