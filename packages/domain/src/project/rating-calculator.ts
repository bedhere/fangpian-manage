export type ProjectGrade = 'S' | 'A' | 'B' | 'C' | 'FAIL';

export type RatingComponents = {
  publisherBusiness: number;
  departmentHeadBusiness: number;
  aiTechnical: number;
  ownerManagerTechnical: number;
  projectManagement: number;
};

export type RatingThresholds = Record<Exclude<ProjectGrade, 'FAIL'>, number>;

const entries = <T extends object>(value: T) =>
  Object.entries(value) as [keyof T, number][];

export function calculateFinalRating(
  scores: RatingComponents,
  weights: RatingComponents,
  thresholds: RatingThresholds,
): { score: number; grade: ProjectGrade } {
  if (entries(weights).reduce((total, [, value]) => total + value, 0) !== 100)
    throw new Error('RATING_WEIGHTS_MUST_TOTAL_100');
  if (entries(scores).some(([, value]) => value < 0 || value > 100))
    throw new Error('RATING_SCORE_OUT_OF_RANGE');

  const score = Math.round(
    entries(scores).reduce(
      (total, [key, value]) => total + value * (weights[key] / 100),
      0,
    ),
  );
  const grade: ProjectGrade =
    score >= thresholds.S
      ? 'S'
      : score >= thresholds.A
        ? 'A'
        : score >= thresholds.B
          ? 'B'
          : score >= thresholds.C
            ? 'C'
            : 'FAIL';
  return { score, grade };
}

export const requiresExecutiveConfirmation = (
  grade: ProjectGrade,
  projectValue: number,
  highValueThreshold: number,
) => grade === 'S' || grade === 'A' || projectValue > highValueThreshold;
