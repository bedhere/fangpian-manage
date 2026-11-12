import { describe, expect, it } from 'vitest';
import { canTransition, transitionProject, InvalidProjectTransitionError } from './state-machine.js';

describe('project state machine', () => {
  it.each([
    ['DRAFT','AI_TRIAGE'], ['AI_TRIAGE','AI_EXECUTABLE'], ['AI_TRIAGE','HUMAN_REQUIRED'],
    ['AI_EXECUTABLE','AI_WORKSPACE'], ['AI_WORKSPACE','AI_COMPLETED'],
    ['HUMAN_REQUIRED','DEPARTMENT_REVIEW'], ['DEPARTMENT_REVIEW','TECH_REVIEW'],
    ['TECH_REVIEW','APPROVED'], ['APPROVED','PUBLISHED'], ['PUBLISHED','APPLICATION_OPEN'],
  ] as const)('allows %s -> %s', (from, to) => expect(canTransition(from, to)).toBe(true));

  it('rejects arbitrary state jumps', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(() => transitionProject('DRAFT', 'PUBLISHED')).toThrow(InvalidProjectTransitionError);
  });

  it('allows both review stages to reject or request revision', () => {
    expect(canTransition('DEPARTMENT_REVIEW', 'REJECTED')).toBe(true);
    expect(canTransition('TECH_REVIEW', 'HUMAN_REQUIRED')).toBe(true);
  });
});
