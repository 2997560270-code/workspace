import { createHmac, timingSafeEqual } from "node:crypto";
import type { TrainingHistoryRecord } from "./training-history";

// FB-014：评分完整性。评分由服务端计算与存储，记录离开服务端前用
// HMAC-SHA256 对所有评分相关字段签名；任何本地篡改都会导致校验失败，
// 被篡改记录会被标记为不可信并排除出能力证据。
// 本模块依赖 node:crypto，只能被服务端代码（route handler / 服务端测试）引用。

const ALGORITHM = "hmac-sha256";
const VERSION = 1;
// 未配置 INTEGRITY_SECRET 时使用开发默认值；生产环境必须显式配置。
const DEV_SECRET = "product-drill-integrity-dev-secret";

function getIntegritySecret(): string {
  return process.env.INTEGRITY_SECRET?.trim() || DEV_SECRET;
}

// 只签名评分与证据相关字段；mentorNote 等纯展示字段不参与签名。
function canonicalPayload(record: TrainingHistoryRecord): unknown {
  return {
    version: VERSION,
    id: record.id,
    sessionId: record.sessionId,
    scenarioId: record.scenarioId,
    scenarioVersion: record.scenarioVersion,
    rubricVersion: record.rubricVersion,
    modelVersion: record.modelVersion,
    engine: record.engine,
    mode: record.mode,
    completedAt: record.completedAt,
    totalScore: record.totalScore,
    messages: record.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      turnIndex: message.turnIndex
    })),
    evaluation: {
      id: record.evaluation.id,
      totalScore: record.evaluation.totalScore,
      summary: record.evaluation.summary,
      confidence: record.evaluation.confidence,
      engine: record.evaluation.engine,
      modelVersion: record.evaluation.modelVersion,
      rubricVersion: record.evaluation.rubricVersion,
      scenarioVersion: record.evaluation.scenarioVersion,
      dimensions: record.evaluation.dimensions.map((dimension) => ({
        id: dimension.id,
        score: dimension.score,
        level: dimension.level,
        confidence: dimension.confidence
      })),
      issues: record.evaluation.issues.map((issue) => issue.id)
    },
    retry: record.retry
      ? {
          issueId: record.retry.issueId,
          targetSkill: record.retry.targetSkill,
          improved: record.retry.improved,
          engine: record.retry.engine ?? null,
          modelVersion: record.retry.modelVersion ?? null
        }
      : null
  };
}

function computeSignature(record: TrainingHistoryRecord): string {
  const payload = JSON.stringify(canonicalPayload(record));
  return createHmac("sha256", getIntegritySecret()).update(payload).digest("hex");
}

export function signTrainingRecord<T extends TrainingHistoryRecord>(record: T): T {
  return {
    ...record,
    integrity: {
      version: VERSION,
      algorithm: ALGORITHM,
      signedAt: new Date().toISOString(),
      signature: computeSignature(record)
    }
  };
}

export function verifyTrainingRecord(record: TrainingHistoryRecord): boolean {
  if (!record.integrity?.signature) return false;
  const expected = computeSignature(record);
  const actual = record.integrity.signature;
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"));
}
