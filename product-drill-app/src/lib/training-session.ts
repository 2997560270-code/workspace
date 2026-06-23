export type TrainingRole = "ai" | "user";

export type TrainingMessage = {
  id: string;
  role: TrainingRole;
  content: string;
};

export type TrainingSession = {
  id: string;
  scenario: string;
  mode: string;
  messages: TrainingMessage[];
};

type TrainingInput = {
  scenario: string;
  mode: string;
  difficulty?: string;
};

let nextId = 1;

function id(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

function aiMessage(content: string): TrainingMessage {
  return { id: id("msg"), role: "ai", content };
}

export function createTrainingSession(input: TrainingInput): TrainingSession {
  const difficulty = input.difficulty ?? "标准";

  return {
    id: id("session"),
    scenario: input.scenario,
    mode: input.mode,
    messages: [
      aiMessage(`训练已开始。当前场景是 ${input.scenario}，模式是 ${input.mode}，难度是 ${difficulty}。请先说出你认为最需要澄清的问题。`)
    ]
  };
}

export function sendTrainingMessage(session: TrainingSession, content: string): TrainingSession {
  const trimmed = content.trim();
  if (!trimmed) {
    return session;
  }

  const userCount = session.messages.filter((message) => message.role === "user").length + 1;
  return {
    ...session,
    messages: [
      ...session.messages,
      { id: id("msg"), role: "user", content: trimmed },
      aiMessage(`第 ${userCount} 轮继续追问：这个回答对应的真实用户、业务场景和可验证指标分别是什么？`)
    ]
  };
}

export function addTrainingAnswer(session: TrainingSession, content: string): TrainingSession {
  const trimmed = content.trim();
  if (!trimmed) {
    return session;
  }

  return {
    ...session,
    messages: [
      ...session.messages,
      { id: id("msg"), role: "user", content: trimmed }
    ]
  };
}
