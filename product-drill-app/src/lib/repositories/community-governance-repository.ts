import { createSupabaseAdminClient } from "../supabase/admin";
import { calculateReviewerReputation, calculateTrainingCredit, type QualityVote } from "../community-governance";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";

async function requireAdmin(userId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Governance persistence is not configured");
    return null;
  }
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.account_role !== "admin") throw new Error("Admin role required");
  return admin;
}

export async function submitReviewQualityVoteRecord(userId: string, input: { reviewId: string; vote: "helpful" | "unclear" | "harmful"; reason: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Governance persistence is not configured");
    return withLocalRuntimeState((state) => {
      const review = state.validationReviews.find((item) => item.id === input.reviewId);
      if (!review) throw new Error("Review not found");
      if (review.reviewer_id === userId) throw new Error("Reviewers cannot vote on their own review");
      if (state.qualityVotes.some((item) => item.review_id === input.reviewId && item.voter_id === userId)) throw new Error("Review vote already exists");
      const vote = { id: crypto.randomUUID(), review_id: input.reviewId, voter_id: userId, vote: input.vote, reason: input.reason.trim(), created_at: new Date().toISOString() };
      state.qualityVotes.push(vote);
      return vote;
    });
  }
  const { data: review, error: reviewError } = await admin.from("blind_reviews").select("reviewer_id").eq("id", input.reviewId).maybeSingle();
  if (reviewError) throw reviewError;
  if (!review) throw new Error("Review not found");
  if (review.reviewer_id === userId) throw new Error("Reviewers cannot vote on their own review");
  const { data, error } = await admin.from("review_quality_votes").insert({ review_id: input.reviewId, voter_id: userId, vote: input.vote, reason: input.reason.trim() }).select("id,review_id,voter_id,vote,reason,created_at").single();
  if (error) throw error;
  return data;
}

export async function recalculateReviewerReputationRecord(userId: string, cohortId: string) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const assignments = state.validationAssignments.filter((item) => item.cohort_id === cohortId && item.status === "submitted");
      const result: Array<Record<string, unknown>> = [];
      const reviewers = new Set(assignments.map((item) => item.reviewer_id));
      for (const reviewerId of reviewers) {
        const assignmentIds = assignments.filter((item) => item.reviewer_id === reviewerId).map((item) => item.id);
        const reviews = state.validationReviews.filter((item) => assignmentIds.includes(item.assignment_id));
        const votes = state.qualityVotes.filter((item) => reviews.some((review) => review.id === item.review_id)).map((item) => ({ vote: item.vote, reason: item.reason })) as QualityVote[];
        const reputation = calculateReviewerReputation(votes, reviews.length);
        const row = { cohort_id: cohortId, reviewer_id: reviewerId, quality_score: reputation.qualityScore, review_count: reputation.reviewCount, quality_vote_count: reputation.qualityVoteCount, status: reputation.status, updated_at: new Date().toISOString() };
        state.reputations = state.reputations.filter((item) => !(item.cohort_id === cohortId && item.reviewer_id === reviewerId));
        state.reputations.push(row);
        result.push(row);
      }
      return result;
    });
  }
  const { data: assignments, error: assignmentError } = await admin.from("blind_review_assignments").select("id,reviewer_id").eq("cohort_id", cohortId).eq("status", "submitted");
  if (assignmentError) throw assignmentError;
  const assignmentIds = (assignments ?? []).map((item) => item.id);
  if (!assignmentIds.length) return [];
  const { data: reviews, error: reviewError } = await admin.from("blind_reviews").select("id,reviewer_id,assignment_id").in("assignment_id", assignmentIds);
  if (reviewError) throw reviewError;
  const reviewIds = (reviews ?? []).map((item) => item.id);
  const { data: votes, error: voteError } = reviewIds.length ? await admin.from("review_quality_votes").select("review_id,vote,reason").in("review_id", reviewIds) : { data: [], error: null };
  if (voteError) throw voteError;
  const result = [];
  for (const reviewerId of new Set((reviews ?? []).map((item) => item.reviewer_id))) {
    const reviewerReviews = (reviews ?? []).filter((item) => item.reviewer_id === reviewerId);
    const reviewerVotes = (votes ?? []).filter((vote) => reviewerReviews.some((review) => review.id === vote.review_id)).map((vote) => ({ vote: vote.vote, reason: vote.reason })) as QualityVote[];
    const reputation = calculateReviewerReputation(reviewerVotes, reviewerReviews.length);
    const { data, error } = await admin.from("reviewer_reputation").upsert({ cohort_id: cohortId, reviewer_id: reviewerId, quality_score: reputation.qualityScore, review_count: reputation.reviewCount, quality_vote_count: reputation.qualityVoteCount, status: reputation.status, updated_at: new Date().toISOString() }).select("cohort_id,reviewer_id,quality_score,review_count,quality_vote_count,status,updated_at").single();
    if (error) throw error;
    result.push(data);
  }
  return result;
}

export async function createReviewRerouteRecord(userId: string, input: { poolEntryId: string; aggregateId?: string; reason: string }) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const reroute = { id: crypto.randomUUID(), pool_entry_id: input.poolEntryId, aggregate_id: input.aggregateId ?? null, reason: input.reason.trim(), status: "open", created_at: new Date().toISOString() };
      state.reroutes.push(reroute);
      return reroute;
    });
  }
  const { data, error } = await admin.from("review_reroutes").insert({ pool_entry_id: input.poolEntryId, aggregate_id: input.aggregateId ?? null, reason: input.reason.trim(), status: "open" }).select("id,pool_entry_id,aggregate_id,reason,status,created_at").single();
  if (error) throw error;
  return data;
}

export async function issueTrainingCreditRecord(userId: string, input: { recipientId: string; sourceReviewId: string; amount: number; reason: string; expiresAt: string }) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      if (state.credits.some((item) => item.source_review_id === input.sourceReviewId)) throw new Error("Credit cap reached");
      const alreadyIssued = state.credits.filter((item) => item.user_id === input.recipientId).reduce((sum, item) => sum + Number(item.amount), 0);
      const settled = calculateTrainingCredit({ qualityScore: 1, reviewCount: 3, qualityVoteCount: 3, status: "trusted" }, alreadyIssued);
      const amount = Math.min(input.amount, settled.amount);
      if (amount <= 0) throw new Error("Credit cap reached");
      const credit = { id: crypto.randomUUID(), user_id: input.recipientId, amount, reason: input.reason.trim(), source_review_id: input.sourceReviewId, expires_at: input.expiresAt, created_at: new Date().toISOString() };
      state.credits.push(credit);
      return credit;
    });
  }
  const { data: existing, error: existingError } = await admin.from("training_credit_ledger").select("amount").eq("user_id", input.recipientId);
  if (existingError) throw existingError;
  const alreadyIssued = (existing ?? []).reduce((sum, item) => sum + item.amount, 0);
  const settled = calculateTrainingCredit({ qualityScore: 1, reviewCount: 3, qualityVoteCount: 3, status: "trusted" }, alreadyIssued);
  const amount = Math.min(input.amount, settled.amount);
  if (amount <= 0) throw new Error("Credit cap reached");
  const { data, error } = await admin.from("training_credit_ledger").insert({ user_id: input.recipientId, amount, reason: input.reason.trim(), source_review_id: input.sourceReviewId, expires_at: input.expiresAt }).select("id,user_id,amount,reason,source_review_id,expires_at,created_at").single();
  if (error) throw error;
  return data;
}

export async function createSeasonalChallengeRecord(userId: string, input: { slug: string; title: string; description: string; startsAt: string; endsAt: string; challengePool: unknown[] }) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const challenge = { id: crypto.randomUUID(), slug: input.slug.trim(), title: input.title.trim(), description: input.description.trim(), starts_at: input.startsAt, ends_at: input.endsAt, status: "draft", challenge_pool: input.challengePool, created_by: userId, created_at: new Date().toISOString() };
      state.challenges.push(challenge);
      return challenge;
    });
  }
  const { data, error } = await admin.from("seasonal_challenges").insert({ slug: input.slug.trim(), title: input.title.trim(), description: input.description.trim(), starts_at: input.startsAt, ends_at: input.endsAt, challenge_pool: input.challengePool, status: "draft", created_by: userId }).select("id,slug,title,description,starts_at,ends_at,status,challenge_pool,created_at").single();
  if (error) throw error;
  return data;
}

export async function listSeasonalChallengesRecord() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => state.challenges.filter((item) => ["published", "active"].includes(String(item.status))));
  }
  const { data, error } = await admin.from("seasonal_challenges").select("id,slug,title,description,starts_at,ends_at,status,challenge_pool").in("status", ["published", "active"]).order("starts_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function publishSeasonalChallengeRecord(userId: string, challengeId: string) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const challenge = state.challenges.find((item) => item.id === challengeId);
      if (!challenge) throw new Error("Challenge is not available");
      challenge.status = "published";
      return challenge;
    });
  }
  const { data, error } = await admin.from("seasonal_challenges").update({ status: "published" }).eq("id", challengeId).select("id,slug,title,description,starts_at,ends_at,status,challenge_pool").single();
  if (error) throw error;
  return data;
}

export async function enterSeasonalChallengeRecord(userId: string, challengeId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Governance persistence is not configured");
    return withLocalRuntimeState((state) => {
      const challenge = state.challenges.find((item) => item.id === challengeId && ["published", "active"].includes(String(item.status)));
      if (!challenge) throw new Error("Challenge is not available");
      const now = Date.now();
      if (now < new Date(String(challenge.starts_at)).getTime() || now >= new Date(String(challenge.ends_at)).getTime()) throw new Error("Challenge is outside its active window");
      const entry = { challenge_id: challengeId, user_id: userId, attempt_count: 0, status: "active", entered_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      state.challengeEntries = state.challengeEntries.filter((item) => !(item.challenge_id === challengeId && item.user_id === userId));
      state.challengeEntries.push(entry);
      return entry;
    });
  }
  const { data: challenge, error: challengeError } = await admin.from("seasonal_challenges").select("id,status,starts_at,ends_at").eq("id", challengeId).in("status", ["published", "active"]).maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge) throw new Error("Challenge is not available");
  const now = Date.now();
  if (now < new Date(challenge.starts_at).getTime() || now >= new Date(challenge.ends_at).getTime()) throw new Error("Challenge is outside its active window");
  const { data, error } = await admin.from("seasonal_challenge_entries").upsert({ challenge_id: challengeId, user_id: userId, attempt_count: 0, status: "active", updated_at: new Date().toISOString() }).select("challenge_id,user_id,attempt_count,status,entered_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function submitSeasonalChallengeAttemptRecord(userId: string, challengeId: string, score: number) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Governance persistence is not configured");
    return withLocalRuntimeState((state) => {
      const challenge = state.challenges.find((item) => item.id === challengeId && ["published", "active"].includes(String(item.status)));
      if (!challenge) throw new Error("Challenge is not available");
      const now = Date.now();
      if (now < new Date(String(challenge.starts_at)).getTime() || now >= new Date(String(challenge.ends_at)).getTime()) throw new Error("Challenge is outside its active window");
      const current = state.challengeEntries.find((item) => item.challenge_id === challengeId && item.user_id === userId);
      const entry = { ...(current ?? { challenge_id: challengeId, user_id: userId, entered_at: new Date().toISOString() }), attempt_count: Number(current?.attempt_count ?? 0) + 1, provisional_score: Math.max(0, Math.min(1, score)), status: "completed", updated_at: new Date().toISOString() };
      state.challengeEntries = state.challengeEntries.filter((item) => !(item.challenge_id === challengeId && item.user_id === userId));
      state.challengeEntries.push(entry);
      return entry;
    });
  }
  const { data: challenge, error: challengeError } = await admin.from("seasonal_challenges").select("id,status,starts_at,ends_at").eq("id", challengeId).in("status", ["published", "active"]).maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge) throw new Error("Challenge is not available");
  const now = Date.now();
  if (now < new Date(challenge.starts_at).getTime() || now >= new Date(challenge.ends_at).getTime()) throw new Error("Challenge is outside its active window");
  const boundedScore = Math.max(0, Math.min(1, score));
  const { data, error } = await admin.from("seasonal_challenge_entries").upsert({ challenge_id: challengeId, user_id: userId, attempt_count: 1, provisional_score: boundedScore, status: "completed", updated_at: new Date().toISOString() }, { onConflict: "challenge_id,user_id" }).select("challenge_id,user_id,attempt_count,provisional_score,status,entered_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function listSeasonalChallengeLeaderboardRecord(challengeId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) return [];
    return withLocalRuntimeState((state) => state.challengeEntries.filter((item) => item.challenge_id === challengeId && ["active", "completed"].includes(String(item.status))).sort((a, b) => Number(b.provisional_score ?? -1) - Number(a.provisional_score ?? -1)).slice(0, 100).map((entry, index) => ({ ...entry, rank: index + 1 })));
  }
  const { data, error } = await admin.from("seasonal_challenge_entries").select("user_id,attempt_count,provisional_score,status,updated_at").eq("challenge_id", challengeId).in("status", ["active", "completed"]).order("provisional_score", { ascending: false, nullsFirst: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function flagReviewAnomalyRecord(userId: string, input: { cohortId?: string; reviewerId?: string; challengeId?: string; signalType: "rate_limit" | "account_linkage" | "copy_pattern" | "conflict_bypass" | "quality_outlier"; severity: "low" | "medium" | "high"; evidence: Record<string, unknown> }) {
  const admin = await requireAdmin(userId);
  if (!admin) {
    return withLocalRuntimeState((state) => {
      const flag = { id: crypto.randomUUID(), cohort_id: input.cohortId ?? null, reviewer_id: input.reviewerId ?? null, challenge_id: input.challengeId ?? null, signal_type: input.signalType, severity: input.severity, evidence: input.evidence, status: "open", created_at: new Date().toISOString() };
      state.anomalies.push(flag);
      return flag;
    });
  }
  const { data, error } = await admin.from("review_anomaly_flags").insert({ cohort_id: input.cohortId ?? null, reviewer_id: input.reviewerId ?? null, challenge_id: input.challengeId ?? null, signal_type: input.signalType, severity: input.severity, evidence: input.evidence, status: "open" }).select("id,signal_type,severity,evidence,status,created_at").single();
  if (error) throw error;
  return data;
}
