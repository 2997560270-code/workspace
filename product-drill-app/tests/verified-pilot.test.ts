import { describe, expect, it } from "vitest";
import { appendVerifiedProcessEvent, buildVerifiedReport, clearHumanReview, completeVerifiedSession, recordEnvironment, recordManualIdentity, startVerifiedSession } from "../src/lib/verified-pilot";

describe("verified assessment pilot", () => {
  it("requires an approved partner and a completed assessment run", () => {
    expect(() => startVerifiedSession({ organization: { id: "org-1", name: "Partner", status: "pending" }, assessmentRunId: "run-1", participantId: "user-1", consentVersion: "v1", runSubmitted: true })).toThrow(/approved organization/);
    expect(() => startVerifiedSession({ organization: { id: "org-1", name: "Partner", status: "approved" }, assessmentRunId: "run-1", participantId: "user-1", consentVersion: "v1", runSubmitted: false })).toThrow(/submitted/);
  });

  it("records human identity, declared environment and process events without biometrics", () => {
    let session = startVerifiedSession({ organization: { id: "org-1", name: "Partner", status: "approved" }, assessmentRunId: "run-1", participantId: "user-1", consentVersion: "v1", runSubmitted: true });
    session = recordManualIdentity(session, "verified", "reviewer-1");
    session = recordEnvironment(session, { browser: "Chromium", operatingSystem: "Windows", timezone: "Asia/Shanghai", policyVersion: "env-v1" });
    session = appendVerifiedProcessEvent(session, { type: "item_started", payload: { itemKey: "item-1" } });
    expect(session.events.find((event) => event.type === "environment_recorded")?.payload.biometric).toBe(false);
  });

  it("requires human clearance before publishing a pilot-only report", () => {
    let session = startVerifiedSession({ organization: { id: "org-1", name: "Partner", status: "approved" }, assessmentRunId: "run-1", participantId: "user-1", consentVersion: "v1", runSubmitted: true });
    session = recordManualIdentity(session, "verified", "reviewer-1");
    session = recordEnvironment(session, { browser: "Chromium", operatingSystem: "Windows", timezone: "Asia/Shanghai", policyVersion: "env-v1" });
    expect(() => buildVerifiedReport(session, 0.8)).toThrow(/Human review/);
    session = completeVerifiedSession(session);
    session = clearHumanReview(session, "reviewer-1", "cleared");
    const report = buildVerifiedReport(session, 0.8);
    expect(report.judgmentLevel).toBe("strong");
    expect(report.usageStatus).toBe("pilot_only");
  });
});
