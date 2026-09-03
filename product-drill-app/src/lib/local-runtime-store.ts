import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LocalRuntimeState = {
  validationCohorts: Array<Record<string, unknown>>;
  validationParticipants: Array<Record<string, unknown>>;
  validationAssignments: Array<Record<string, unknown>>;
  validationReviews: Array<Record<string, unknown>>;
  validationMeasurements: Array<Record<string, unknown>>;
  reviewPoolEntries: Array<Record<string, unknown>>;
  reviewerConflicts: Array<Record<string, unknown>>;
  reviewAggregates: Array<Record<string, unknown>>;
  qualityVotes: Array<Record<string, unknown>>;
  reputations: Array<Record<string, unknown>>;
  reroutes: Array<Record<string, unknown>>;
  challenges: Array<Record<string, unknown>>;
  challengeEntries: Array<Record<string, unknown>>;
  credits: Array<Record<string, unknown>>;
  anomalies: Array<Record<string, unknown>>;
  assessmentBlueprints: Array<Record<string, unknown>>;
  assessmentItems: Array<Record<string, unknown>>;
  assessmentRuns: Array<Record<string, unknown>>;
  assessmentResponses: Array<Record<string, unknown>>;
  assessmentEvaluations: Array<Record<string, unknown>>;
  assessmentReports: Array<Record<string, unknown>>;
  fairnessMetrics: Array<Record<string, unknown>>;
  organizations: Array<Record<string, unknown>>;
  verifiedSessions: Array<Record<string, unknown>>;
  verifiedEvents: Array<Record<string, unknown>>;
  verifiedReports: Array<Record<string, unknown>>;
  humanReviewCases: Array<Record<string, unknown>>;
  teams: Array<Record<string, unknown>>;
  teamMembers: Array<Record<string, unknown>>;
  teamInvitations: Array<Record<string, unknown>>;
  mentorNotes: Array<Record<string, unknown>>;
  multiRoleSessions: Array<Record<string, unknown>>;
  multiRoleMessages: Array<Record<string, unknown>>;
  localUsers: Array<Record<string, unknown>>;
  communityCases: Array<Record<string, unknown>>;
  knowledgeEntries: Array<Record<string, unknown>>;
  contentAuditLogs: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  feedbackSubmissions: Array<Record<string, unknown>>;
  llmConfigs: Array<Record<string, unknown>>;
};

const EMPTY_STATE: LocalRuntimeState = {
  validationCohorts: [], validationParticipants: [], validationAssignments: [], validationReviews: [], validationMeasurements: [],
  reviewPoolEntries: [], reviewerConflicts: [], reviewAggregates: [], qualityVotes: [], reputations: [], reroutes: [],
  challenges: [], challengeEntries: [], credits: [], anomalies: [], assessmentBlueprints: [], assessmentItems: [], assessmentRuns: [],
  assessmentResponses: [], assessmentEvaluations: [], assessmentReports: [], fairnessMetrics: [], organizations: [], verifiedSessions: [],
  verifiedEvents: [], verifiedReports: [], humanReviewCases: [], teams: [], teamMembers: [], teamInvitations: [], mentorNotes: [],
  multiRoleSessions: [], multiRoleMessages: [], localUsers: [],
  communityCases: [], knowledgeEntries: [], contentAuditLogs: [], subscriptions: [], feedbackSubmissions: [], llmConfigs: [],
};

const STATE_PATH = process.env.LOCAL_RUNTIME_STATE_PATH ?? path.join(process.cwd(), "data", "local-runtime-state.json");
let operationQueue: Promise<unknown> = Promise.resolve();

export function isLocalRuntimeFallbackEnabled() {
  // The Playwright test server runs a production build (dev: false), so also
  // allow the local runtime fallback during E2E-isolated runs. Production and
  // real deployments never set E2E_ISOLATED_USERS.
  return (process.env.E2E_ISOLATED_USERS === "true" || process.env.NODE_ENV !== "production") && process.env.ALLOW_DEMO_AUTH !== "false";
}

async function readState(): Promise<LocalRuntimeState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalRuntimeState>;
    return Object.fromEntries(Object.keys(EMPTY_STATE).map((key) => [key, Array.isArray(parsed[key as keyof LocalRuntimeState]) ? parsed[key as keyof LocalRuntimeState] : []])) as LocalRuntimeState;
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

async function writeState(state: LocalRuntimeState) {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function withLocalRuntimeState<T>(mutator: (state: LocalRuntimeState) => Promise<T> | T): Promise<T> {
  const operation = operationQueue.then(async () => {
    const state = await readState();
    const result = await mutator(state);
    await writeState(state);
    return result;
  });
  operationQueue = operation.catch(() => undefined);
  return operation;
}

export function localId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
