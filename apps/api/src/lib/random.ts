/**
 * Shuffling and unbiased integers.
 *
 * Extracted from the practice selection service when the paper generator became
 * the second thing that needed to draw questions at random. Two Fisher–Yates
 * implementations in one codebase is two chances to get the loop bounds subtly
 * wrong, and the wrong version does not crash — it just quietly never picks the
 * last element, which nobody notices until a question is missing from every
 * paper ever generated.
 */

/** Fisher–Yates, returning a new array. */
export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index--) {
    const swap = randomInt(index + 1);
    const held = result[index];
    const other = result[swap];
    if (held === undefined || other === undefined) continue;
    result[index] = other;
    result[swap] = held;
  }

  return result;
}

/**
 * Uniform in `[0, bound)`.
 *
 * `Math.random()` would do — nothing here is a secret — but `crypto` costs
 * nothing at this size and removes the question of whether it ought to have
 * been used, which is a question that has to be answered again every time
 * somebody reads this.
 *
 * The rejection loop matters more than the source: `value % bound` alone is
 * biased towards the low end whenever `bound` does not divide the range, and a
 * generator biased towards the first questions in the bank would show up as
 * "why is question 4 in every mock paper".
 */
export function randomInt(bound: number): number {
  if (bound <= 1) return 0;

  const limit = Math.floor(0xff_ff_ff_ff / bound) * bound;
  const buffer = new Uint32Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) return value % bound;
  }
}
