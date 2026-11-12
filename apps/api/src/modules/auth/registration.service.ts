import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { pinyin } from 'pinyin-pro';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import {
  assertMentor,
  listMentors,
  serializable,
} from '../trainees/trainee-policy.js';
import type { RegisterDto } from './registration.dto.js';

@Injectable()
export class RegistrationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async organization(db: Pick<PrismaService, 'organization'>) {
    const id = process.env.PUBLIC_REGISTRATION_ORG_ID?.trim();
    if (id) {
      const org = await db.organization.findFirst({
        where: { id, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (org) return org.id;
    } else {
      const orgs = await db.organization.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        take: 2,
      });
      if (orgs.length === 1) return orgs[0].id;
    }
    throw new ServiceUnavailableException('当前未开放注册，请联系管理员');
  }
  async options() {
    try {
      const organizationId = await this.organization(this.prisma);
      return {
        registrationAvailable: true,
        mentors: await listMentors(this.prisma, organizationId),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException)
        return { registrationAvailable: false, mentors: [] };
      throw error;
    }
  }
  async register(input: RegisterDto) {
    const displayName = input.displayName?.trim().normalize('NFKC');
    if (!displayName || displayName.length > 100 || !/\p{L}/u.test(displayName))
      throw new BadRequestException('请填写真实姓名');
    const base = pinyin(displayName, {
      toneType: 'none',
      type: 'array',
      v: true,
    })
      .join('')
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (!base)
      throw new BadRequestException('姓名无法生成安全账号，请联系管理员');
    const passwordHash = await argon2.hash('DEMO_ONLY_ChangeMe_2026!', {
      type: argon2.argon2id,
    });
    for (let suffix = 1; suffix <= 1000; suffix++) {
      const username = `${base}999${suffix === 1 ? '' : suffix}`;
      // LoginDto accepts at most 254 characters, including collision suffixes.
      // Preserve the full pinyin instead of silently truncating the person's name.
      if (username.length > 254)
        throw new BadRequestException('姓名生成的账号过长，请联系管理员');
      try {
        return await serializable(this.prisma, async (tx) => {
          const organizationId = await this.organization(tx);
          if (input.mentorId)
            await assertMentor(tx, organizationId, input.mentorId);
          const role = await tx.role.upsert({
            where: { organizationId_code: { organizationId, code: 'TRAINEE' } },
            create: {
              organizationId,
              code: 'TRAINEE',
              name: '管培生',
              isSystem: true,
            },
            update: {},
            select: { id: true },
          });
          await tx.user.create({
            data: {
              organizationId,
              username,
              email: `${username}@trainees.accounts.invalid`,
              displayName,
              passwordHash,
              status: 'ACTIVE',
              mustChangePassword: true,
              roles: { create: { roleId: role.id } },
              profile: { create: {} },
              traineeProfile: {
                create: { organizationId, mentorId: input.mentorId ?? null },
              },
            },
            select: { id: true },
          });
          return { username, displayName, mustChangePassword: true as const };
        });
      } catch (error) {
        const e = error as {
          code?: string;
          meta?: { target?: string[] | string };
        };
        const target = e.meta?.target;
        if (
          e.code !== 'P2002' ||
          (target &&
            !String(target).includes('username') &&
            !String(target).includes('email'))
        )
          throw error;
      }
    }
    throw new ConflictException('同名账号过多，请联系管理员');
  }
}
