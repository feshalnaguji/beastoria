/** A grown-up question a 4–8 year old can't answer by tapping around. */
export interface GateQuestion {
  a: number;
  b: number;
  answer: number;
  options: number[];
}
export interface GateState {
  strikes: number;
  lockedUntil: number;
}

export const HOLD_MS = 3000;
export const MAX_STRIKES = 3;
export const COOLDOWN_MS = 30_000;

export function makeQuestion(rand: () => number): GateQuestion {
  const pick = () => 3 + Math.floor(rand() * 7); // 3..9
  const a = pick();
  const b = pick();
  const answer = a * b;
  const opts = new Set<number>([answer]);
  for (const c of [answer + a, answer - b, answer + 10, answer - 10, (a + 1) * b, a * (b + 1), answer + 1]) {
    if (opts.size === 4) break;
    if (c > 0) opts.add(c);
  }
  for (let n = 2; opts.size < 4; n++) opts.add(answer + n);
  const options = [...opts];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return { a, b, answer, options };
}

export const newGateState = (): GateState => ({ strikes: 0, lockedUntil: 0 });
export const gateLocked = (s: GateState, nowMs: number): boolean => nowMs < s.lockedUntil;

export function answerGate(
  s: GateState,
  q: GateQuestion,
  choice: number,
  nowMs: number,
): 'correct' | 'wrong' | 'locked' {
  if (gateLocked(s, nowMs)) return 'locked';
  if (choice === q.answer) {
    s.strikes = 0;
    return 'correct';
  }
  s.strikes++;
  if (s.strikes >= MAX_STRIKES) {
    s.strikes = 0;
    s.lockedUntil = nowMs + COOLDOWN_MS;
    return 'locked';
  }
  return 'wrong';
}
