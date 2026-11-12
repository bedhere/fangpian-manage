export type BonusGrade = 'S' | 'A' | 'B' | 'C' | 'FAIL';
export type BonusRule = {
  hourlyRate: string;
  minHours: string;
  maxHours: string;
  multipliers: Record<BonusGrade, string>;
};

const parseHundredths = (value: string) => {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('INVALID_DECIMAL');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const formatHundredths = (value: bigint) =>
  `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;

const roundedDivide = (value: bigint, divisor: bigint) =>
  (value + divisor / 2n) / divisor;

export function calculateProjectBonus(
  approvedHours: string,
  grade: BonusGrade,
  rule: BonusRule,
) {
  const hours = parseHundredths(approvedHours);
  const effectiveHours = BigInt.asUintN(
    64,
    hours < parseHundredths(rule.minHours)
      ? parseHundredths(rule.minHours)
      : hours > parseHundredths(rule.maxHours)
        ? parseHundredths(rule.maxHours)
        : hours,
  );
  const baseBonus = roundedDivide(
    effectiveHours * parseHundredths(rule.hourlyRate),
    100n,
  );
  const finalBonus = roundedDivide(
    baseBonus * parseHundredths(rule.multipliers[grade]),
    100n,
  );
  return {
    effectiveHours: formatHundredths(effectiveHours),
    baseBonus: formatHundredths(baseBonus),
    finalBonus: formatHundredths(finalBonus),
  };
}

export function allocateBonus(
  total: string,
  contributions: Array<{ userId: string; percentage: string }>,
) {
  const totalPercentage = contributions.reduce(
    (sum, item) => sum + parseHundredths(item.percentage),
    0n,
  );
  if (totalPercentage !== 10_000n)
    throw new Error('CONTRIBUTION_PERCENTAGE_MUST_TOTAL_100');
  const totalCents = parseHundredths(total);
  const calculated = contributions.map((item, index) => {
    const percentage = parseHundredths(item.percentage);
    const numerator = totalCents * percentage;
    return {
      index,
      userId: item.userId,
      percentage,
      cents: numerator / 10_000n,
      remainder: numerator % 10_000n,
    };
  });
  let missing = totalCents - calculated.reduce((sum, item) => sum + item.cents, 0n);
  for (const item of [...calculated].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (missing === 0n) break;
    item.cents += 1n;
    missing -= 1n;
  }
  return calculated
    .sort((a, b) => a.index - b.index)
    .map((item) => ({
      userId: item.userId,
      percentage: formatHundredths(item.percentage),
      amount: formatHundredths(item.cents),
    }));
}
