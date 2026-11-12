import { describe, expect, it } from 'vitest';
import { getSettingDefinition, validateRegisteredSetting } from './setting-registry.js';

describe('setting registry', () => {
  it('defines typed fields for every seeded business setting', () => {
    expect(getSettingDefinition('matching.weights')?.fields.length).toBeGreaterThan(0);
    expect(getSettingDefinition('rating.highValueThreshold')?.fields[0]?.type).toBe('number');
  });

  it('rejects invalid values and unknown keys', () => {
    expect(() => validateRegisteredSetting('rating.highValueThreshold', -1)).toThrow('INVALID_SETTING_VALUE');
    expect(() => validateRegisteredSetting('unknown.setting', {})).toThrow('UNKNOWN_SETTING');
  });

  it('accepts valid configuration-backed values', () => {
    expect(() => validateRegisteredSetting('settlement.lockDay', 15)).not.toThrow();
    expect(() => validateRegisteredSetting('feedback.skillVerification', { minimumContributionPercentage: 20, acceptedGrades: ['S', 'A'] })).not.toThrow();
    expect(() => validateRegisteredSetting('feedback.capabilityProgression', { L0: 0, L1: 105, L2: 115, L3: 130, L4: 150, allowAutomaticDemotion: false })).not.toThrow();
  });
});
