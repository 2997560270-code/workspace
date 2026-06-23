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
  scenarioUserOffset: number;
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
    scenarioUserOffset: 0,
    messages: [
      aiMessage(`训练已开始。当前场景是 ${input.scenario}，模式是 ${input.mode}，难度是 ${difficulty}。您的具体业务是什么？`)
    ]
  };
}

export function sendTrainingMessage(session: TrainingSession, content: string): TrainingSession {
  const trimmed = content.trim();
  if (!trimmed) {
    return session;
  }

  const totalUserCount = session.messages.filter((message) => message.role === "user").length;
  const userCount = totalUserCount - session.scenarioUserOffset + 1;
  const followUp = userCount === 1
    ? `你提到的具体业务是“${trimmed}”。围绕 ${session.scenario} 方向，我想先确认：目标用户是谁、真实使用场景是什么、你希望验证的业务指标是什么？`
    : `第 ${userCount} 轮继续追问：这个回答对应的真实用户、业务场景和可验证指标分别是什么？`;

  return {
    ...session,
    messages: [
      ...session.messages,
      { id: id("msg"), role: "user", content: trimmed },
      aiMessage(followUp)
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

export function changeTrainingScenario(
  session: TrainingSession,
  scenario: string,
  mode: string,
  difficulty: string
): TrainingSession {
  const totalUserCount = session.messages.filter((message) => message.role === "user").length;

  return {
    ...session,
    scenario,
    mode,
    scenarioUserOffset: totalUserCount,
    messages: [
      ...session.messages,
      aiMessage(`当前行业场景已经切换到${scenario}，模式${mode}，难度${difficulty}。您的具体业务是什么？`)
    ]
  };
}
