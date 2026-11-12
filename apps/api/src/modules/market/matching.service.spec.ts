import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MatchingService } from './matching.service.js';

describe('MatchingService', () => {
  it('fails explicitly when configured matching rules are missing', async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          organizationId: 'org-1',
          profile: { capabilityLevel: 'L2', reputationScore: 80 },
          skills: [],
          capacities: [],
        }),
      },
      project: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          requiredCapabilityLevel: 'L2',
          requiredSkills: [],
          estimatedHours: 20,
        }),
      },
      systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new MatchingService(prisma as never);

    await expect(service.calculate('user-1', 'project-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
