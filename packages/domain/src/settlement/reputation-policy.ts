export function applyReputationEvents<T extends string>(
  currentScore: number,
  events: T[],
  configuredDeltas: Record<T, number>,
) {
  const deltas = events.map((event) => configuredDeltas[event]);
  return {
    score: Math.max(0, currentScore + deltas.reduce((sum, value) => sum + value, 0)),
    deltas,
  };
}
