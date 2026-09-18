"use client";

import { useEffect, useState } from "react";
import { FeedbackApiError, submitFeedback } from "../lib/api/feedback-client";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "../lib/api/feedback-schemas";
import { ChatCircleDots, X } from "@phosphor-icons/react";
import { useDialogA11y } from "../lib/dialog-a11y";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "遇到问题",
  experience: "使用体验",
  feature: "功能建议",
  other: "其他",
};

type SubmitState = "idle" | "submitting" | "success" | "error";

// 反馈入口挂在页头（与「设置」同一排），点击后打开居中模态表单，POST 到 /api/feedback。
// 不用 fixed FAB：悬浮按钮在滚动中途会盖住右栏正文，用户要么被遮挡要么被迫等滚到底。
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("experience");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [page, setPage] = useState("");

  useEffect(() => {
    if (open) setPage(window.location.pathname + window.location.search);
  }, [open]);

  const contentLength = content.trim().length;
  const canSubmit = contentLength >= 5 && state !== "submitting";

  async function handleSubmit() {
    if (!canSubmit) return;
    setState("submitting");
    setErrorMsg("");
    try {
      await submitFeedback({
        category,
        content: content.trim(),
        contact: contact.trim() || undefined,
        page: page || undefined,
        rating: rating > 0 ? rating : undefined,
      });
      setState("success");
      setContent("");
      setContact("");
      setRating(0);
    } catch (error) {
      setState("error");
      setErrorMsg(error instanceof FeedbackApiError ? error.message : "提交失败，请稍后再试。");
    }
  }

  function close() {
    setOpen(false);
    setState("idle");
    setErrorMsg("");
  }

  const dialog = useDialogA11y(close, open);

  return (
    <>
      <button
        aria-expanded={open}
        className="topbar-settings-button"
        data-testid="feedback-open"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ChatCircleDots aria-hidden="true" size={15} /> 反馈
      </button>

      {open ? (
        <div className="settings-overlay" onMouseDown={close}>
          <div
            aria-label="用户反馈"
            aria-modal="true"
            className="feedback-dialog surface"
            onKeyDown={dialog.onKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
            ref={dialog.ref}
            role="dialog"
            tabIndex={-1}
          >
            <div className="feedback-dialog-header">
              <div>
                <span className="section-kicker">使用反馈</span>
                <h2>帮我们改进产品</h2>
              </div>
              <button className="feedback-dialog-close" onClick={close} type="button" aria-label="关闭">
                <X aria-hidden="true" size={16} weight="bold" />
              </button>
            </div>
            {state === "success" ? (
              <div className="feedback-dialog-success" data-testid="feedback-success">
                <strong>已收到，感谢你的反馈！</strong>
                <p>我们会在后台整理这些内容，用于后续迭代。</p>
                <button className="button button-secondary" onClick={close} type="button">
                  关闭
                </button>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
              >
                <div className="feedback-field">
                  <span className="detail-label">反馈类型</span>
                  <select
                    aria-label="反馈类型"
                    onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                    value={category}
                  >
                    {FEEDBACK_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {CATEGORY_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </div>
  
                <div className="feedback-field">
                  <span className="detail-label">体验评分（可选）</span>
                  <div className="feedback-rating" role="group" aria-label="体验评分">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        aria-label={value + " 星"}
                        aria-pressed={rating === value}
                        className={rating === value ? "on" : ""}
                        key={value}
                        onClick={() => setRating(value)}
                        type="button"
                      >
                        {value}
                      </button>
                    ))}
                    {rating > 0 ? <span className="feedback-rating-label">{rating} / 5</span> : null}
                  </div>
                </div>
  
                <div className="feedback-field">
                  <label className="detail-label" htmlFor="feedback-content">
                    反馈内容
                  </label>
                  <textarea
                    autoFocus
                    id="feedback-content"
                    maxLength={2000}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="想告诉我们什么？例如哪一步不好用、哪里卡住了、希望加什么。"
                    rows={4}
                    value={content}
                  />
                  <span className="feedback-limit">至少 5 个字（当前 {contentLength} 字）</span>
                </div>
  
                <div className="feedback-field">
                  <label className="detail-label" htmlFor="feedback-contact">
                    联系方式（可选，方便我们回访）
                  </label>
                  <input
                    id="feedback-contact"
                    maxLength={100}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="邮箱 / 微信 / 手机号"
                    type="text"
                    value={contact}
                  />
                </div>
  
                <div className="feedback-page">当前页面：{page || "—"}</div>
  
                {state === "error" ? (
                  <p className="feedback-error" data-testid="feedback-error" role="alert">{errorMsg}</p>
                ) : null}
  
                <div className="feedback-actions">
                  <button
                    aria-busy={state === "submitting"}
                    className="button button-primary"
                    disabled={!canSubmit}
                    type="submit"
                  >
                    {state === "submitting" ? "提交中…" : "提交反馈"}
                  </button>
                  <button className="text-button" onClick={close} type="button">
                    取消
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
