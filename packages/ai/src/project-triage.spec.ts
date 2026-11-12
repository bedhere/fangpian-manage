import { describe, expect, it } from 'vitest';
import { projectTriageSchema } from './project-triage.schema.js';
describe('AI project triage schema', () => {
  it('accepts a complete structured assessment', () => expect(projectTriageSchema.parse({ aiCanCompleteAlone:false, shouldCreateProject:true, confidence:0.93, businessValueScore:80, technicalComplexityScore:60, urgencyScore:70, recommendedProjectLevel:'P2', requiredCapabilityLevel:3, estimatedHours:20, requiredSkills:['AI','开发'], reason:'需要人工设计流程' }).recommendedProjectLevel).toBe('P2'));
  it('rejects unstructured model output and out-of-range scores', () => { expect(() => projectTriageSchema.parse('可以立项')).toThrow(); expect(() => projectTriageSchema.parse({ businessValueScore: 120 })).toThrow(); });
});
