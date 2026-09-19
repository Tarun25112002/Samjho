import {
  TARGET_LEVEL_MAX,
  TARGET_LEVEL_MIN,
  type AssessmentBlendEntry,
  type AssessmentObjective,
  type Difficulty,
  type SelectionReason,
} from "@medhavi/contracts";

export interface TopicMasteryState {
  topicId: string;
  topicName: string;
  subjectId: string;
  masteryScore: number;
  attempted: number;
  unrepairedMistakes: number;
}

export interface AnsweredOutcome {
  topicId: string | null;
  targetLevel: number;
  isCorrect: boolean;
  hintUsed: boolean;
  paceRatio: number;
}

export interface NextPick {
  reason: SelectionReason;
  targetLevel: number;
  topicId: string | null;
  topicName: string | null;
  masteryAtPick: number | null;
}

const SLOW_PACE_RATIO = 1.6;
const OPENING_LEVEL = 3;

const DIAGNOSTIC_LADDERS = {
  DIAGNOSTIC_FUNDAMENTALS: [1, 1, 2, 1, 2, 2, 1, 2, 3, 2],
  DIAGNOSTIC_APPLICATION: [2, 3, 3, 2, 3, 4, 3, 3, 4, 3],
  DIAGNOSTIC_CHALLENGE: [3, 4, 4, 3, 5, 4, 5, 4, 5, 5],
} as const satisfies Record<string, readonly number[]>;

const BLEND_SHARES: ReadonlyArray<{ reason: SelectionReason; share: number }> = [
  { reason: "WEAK_AREA", share: 0.4 },
  { reason: "REINFORCEMENT", share: 0.3 },
  { reason: "CURRENT_LEVEL", share: 0.2 },
  { reason: "CHALLENGE", share: 0.1 },
];

export function isDiagnostic(objective: AssessmentObjective): boolean {
  return objective !== "ADAPTIVE_PERSONALISED";
}

export function clampLevel(level: number): number {
  return Math.min(TARGET_LEVEL_MAX, Math.max(TARGET_LEVEL_MIN, Math.round(level)));
}

export function levelForMastery(mastery: number): number {
  return clampLevel(1 + mastery * 4);
}

export function levelsToDifficulties(level: number): Difficulty[] {
  switch (clampLevel(level)) {
    case 1:
      return ["EASY", "MEDIUM"];
    case 2:
      return ["EASY", "MEDIUM", "HARD"];
    case 3:
      return ["MEDIUM", "EASY", "HARD"];
    case 4:
      return ["HARD", "MEDIUM", "EASY"];
    default:
      return ["HARD", "MEDIUM"];
  }
}

export function nextLevelAfter(current: number, outcome: AnsweredOutcome, streak: number): number {
  const level = clampLevel(current);

  if (!outcome.isCorrect) {
    return clampLevel(level - (streak <= -2 ? 2 : 1));
  }

  if (outcome.hintUsed) return level;
  if (outcome.paceRatio > SLOW_PACE_RATIO) return level;

  return clampLevel(level + (streak >= 2 ? 2 : 1));
}

export function nextStreak(current: number, isCorrect: boolean): number {
  if (isCorrect) return current >= 0 ? current + 1 : 1;
  return current <= 0 ? current - 1 : -1;
}

export function diagnosticLevelAt(objective: AssessmentObjective, index: number): number {
  if (objective === "ADAPTIVE_PERSONALISED") return OPENING_LEVEL;
  const ladder = DIAGNOSTIC_LADDERS[objective];
  return clampLevel(ladder[index % ladder.length] ?? OPENING_LEVEL);
}

export function planBlend(count: number): AssessmentBlendEntry[] {
  const entries = BLEND_SHARES.map(({ reason, share }) => ({
    reason,
    count: Math.floor(count * share),
  }));

  let assigned = entries.reduce((sum, entry) => sum + entry.count, 0);
  let cursor = 0;
  while (assigned < count) {
    const entry = entries[cursor % entries.length];
    if (entry) {
      entry.count += 1;
      assigned += 1;
    }
    cursor += 1;
  }

  return entries.filter((entry) => entry.count > 0);
}

export function blendSequence(count: number): SelectionReason[] {
  const blend = planBlend(count);
  const remaining = new Map(blend.map((entry) => [entry.reason, entry.count]));
  const order: SelectionReason[] = [
    "CURRENT_LEVEL",
    "WEAK_AREA",
    "REINFORCEMENT",
    "WEAK_AREA",
    "CHALLENGE",
    "REINFORCEMENT",
  ];

  const sequence: SelectionReason[] = [];
  let cursor = 0;

  while (sequence.length < count) {
    const candidate = order[cursor % order.length] ?? "CURRENT_LEVEL";
    cursor += 1;

    const left = remaining.get(candidate) ?? 0;
    if (left > 0) {
      remaining.set(candidate, left - 1);
      sequence.push(candidate);
      continue;
    }

    const fallback = [...remaining.entries()].find(([, value]) => value > 0);
    if (!fallback) break;
    remaining.set(fallback[0], fallback[1] - 1);
    sequence.push(fallback[0]);
  }

  return sequence;
}

export function chooseTopic(
  states: TopicMasteryState[],
  reason: SelectionReason,
  exclude: ReadonlySet<string>,
): TopicMasteryState | null {
  const seen = states.filter((state) => state.attempted > 0 && !exclude.has(state.topicId));
  const unseen = states.filter((state) => state.attempted === 0 && !exclude.has(state.topicId));

  switch (reason) {
    case "COVERAGE":
      return unseen[0] ?? lowest(seen) ?? null;
    case "WEAK_AREA":
      return lowest(seen) ?? unseen[0] ?? null;
    case "CHALLENGE":
      return highest(seen) ?? unseen[0] ?? null;
    case "REINFORCEMENT":
      return nearest(seen, 0.55) ?? lowest(seen) ?? unseen[0] ?? null;
    default:
      return nearest(seen, median(seen)) ?? unseen[0] ?? null;
  }
}

export function levelForPick(reason: SelectionReason, mastery: number | null): number {
  const base = mastery === null ? OPENING_LEVEL : levelForMastery(mastery);

  switch (reason) {
    case "WEAK_AREA":
      return clampLevel(base - 1);
    case "CHALLENGE":
      return clampLevel(base + 1);
    case "COVERAGE":
      return clampLevel(Math.min(base, OPENING_LEVEL));
    default:
      return base;
  }
}

export function pickNext(input: {
  objective: AssessmentObjective;
  index: number;
  states: TopicMasteryState[];
  history: AnsweredOutcome[];
  servedTopicIds: ReadonlySet<string>;
  count: number;
}): NextPick {
  const { objective, index, states, history, servedTopicIds, count } = input;

  if (isDiagnostic(objective)) {
    const level = diagnosticLevelAt(objective, index);
    const topic = chooseTopic(states, "COVERAGE", servedTopicIds);

    return {
      reason: "DIAGNOSTIC_LADDER",
      targetLevel: level,
      topicId: topic?.topicId ?? null,
      topicName: topic?.topicName ?? null,
      masteryAtPick: topic && topic.attempted > 0 ? topic.masteryScore : null,
    };
  }

  const sequence = blendSequence(count);
  const reason = sequence[index] ?? "CURRENT_LEVEL";
  const topic = chooseTopic(states, reason, servedTopicIds);
  const mastery = topic && topic.attempted > 0 ? topic.masteryScore : null;

  const drift = driftFromHistory(history, topic?.topicId ?? null);
  const targetLevel = clampLevel(levelForPick(reason, mastery) + drift);

  return {
    reason,
    targetLevel,
    topicId: topic?.topicId ?? null,
    topicName: topic?.topicName ?? null,
    masteryAtPick: mastery,
  };
}

function driftFromHistory(history: AnsweredOutcome[], topicId: string | null): number {
  const recent = history.slice(-3);
  if (recent.length === 0) return 0;

  const onTopic = topicId === null ? recent : recent.filter((item) => item.topicId === topicId);
  const frame = onTopic.length > 0 ? onTopic : recent;

  let streak = 0;
  for (const outcome of frame) streak = nextStreak(streak, outcome.isCorrect);

  const last = frame.at(-1);
  if (!last) return 0;

  const moved = nextLevelAfter(last.targetLevel, last, streak);
  return Math.sign(moved - last.targetLevel);
}

function lowest(states: TopicMasteryState[]): TopicMasteryState | null {
  return [...states].sort(byMastery)[0] ?? null;
}

function highest(states: TopicMasteryState[]): TopicMasteryState | null {
  return [...states].sort(byMastery).at(-1) ?? null;
}

function nearest(states: TopicMasteryState[], target: number): TopicMasteryState | null {
  return (
    [...states].sort((a, b) => {
      const delta = Math.abs(a.masteryScore - target) - Math.abs(b.masteryScore - target);
      return delta !== 0 ? delta : a.topicId.localeCompare(b.topicId);
    })[0] ?? null
  );
}

function median(states: TopicMasteryState[]): number {
  if (states.length === 0) return 0.5;
  const scores = states.map((state) => state.masteryScore).sort((a, b) => a - b);
  const middle = Math.floor(scores.length / 2);
  if (scores.length % 2 === 1) return scores[middle] ?? 0.5;
  return ((scores[middle - 1] ?? 0.5) + (scores[middle] ?? 0.5)) / 2;
}

function byMastery(a: TopicMasteryState, b: TopicMasteryState): number {
  const delta = a.masteryScore - b.masteryScore;
  if (delta !== 0) return delta;
  const mistakes = b.unrepairedMistakes - a.unrepairedMistakes;
  if (mistakes !== 0) return mistakes;
  return a.topicId.localeCompare(b.topicId);
}
