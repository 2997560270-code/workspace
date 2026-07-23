import { getCurrentUser } from "../auth-server";
import type { ProductDrillUser } from "../auth";
import type { TrainingHistoryRecord } from "../training-history";
import type { TrainingSession } from "../training-session";
import { TrainingHistoryRecordSchema, TrainingSessionSchema } from "./schemas";

export async function requireApiUser(): Promise<ProductDrillUser | null> {
  return getCurrentUser();
}

export function apiError(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export function canSyncClientHistory(userSource: ProductDrillUser["source"]): boolean {
  return userSource === "demo";
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validateSessionForPath(value: unknown, sessionId: string): TrainingSession | null {
  const result = TrainingSessionSchema.safeParse(value);
  return result.success && result.data.id === sessionId ? result.data as TrainingSession : null;
}

export function resolveSessionSnapshot(input: { stored: unknown; supplied: unknown; sessionId: string; allowMissingStored: boolean }): TrainingSession | null {
  const stored = TrainingSessionSchema.safeParse(input.stored);
  const supplied = TrainingSessionSchema.safeParse(input.supplied);
  const storedSession = stored.success && stored.data.id === input.sessionId ? stored.data as TrainingSession : null;
  const suppliedSession = supplied.success && supplied.data.id === input.sessionId ? supplied.data as TrainingSession : null;

  if (!storedSession) return input.allowMissingStored ? suppliedSession : null;
  if (!suppliedSession) return storedSession;
  const sameIdentity = suppliedSession.scenarioId === storedSession.scenarioId
    && suppliedSession.scenarioVersion === storedSession.scenarioVersion
    && suppliedSession.rubricVersion === storedSession.rubricVersion;
  const storedTranscriptIsPrefix = storedSession.messages.every((message, index) => {
    const candidate = suppliedSession.messages[index];
    return candidate?.id === message.id
      && candidate.role === message.role
      && candidate.content === message.content
      && candidate.turnIndex === message.turnIndex;
  });
  const clientOnlyMessages = suppliedSession.messages.slice(storedSession.messages.length);
  const clientExtensionIsHintOnly = clientOnlyMessages.every((message) => message.role === "ai" && !message.revealedSkill);
  const coveredSkillsUnchanged = suppliedSession.coveredSkills.length === storedSession.coveredSkills.length
    && suppliedSession.coveredSkills.every((skill) => storedSession.coveredSkills.includes(skill));
  const engineMetadataUnchanged = suppliedSession.engine === storedSession.engine
    && suppliedSession.modelVersion === storedSession.modelVersion;
  const hintCountIsConsistent = suppliedSession.hintsUsed === storedSession.hintsUsed + clientOnlyMessages.length;
  const modeUnchanged = suppliedSession.mode === storedSession.mode;
  return sameIdentity
    && storedTranscriptIsPrefix
    && clientExtensionIsHintOnly
    && coveredSkillsUnchanged
    && engineMetadataUnchanged
    && hintCountIsConsistent
    && modeUnchanged
    ? suppliedSession
    : storedSession;
}

export function validateHistoryForPath(value: unknown, sessionId: string): TrainingHistoryRecord | null {
  const result = TrainingHistoryRecordSchema.safeParse(value);
  return result.success && result.data.sessionId === sessionId ? result.data as TrainingHistoryRecord : null;
}
