import { PrismaClient, CapabilityLevel } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const password = 'DEMO_ONLY_ChangeMe_2026!';

async function main() {
  const organization = await prisma.organization.upsert({ where: { slug: 'valueflow-demo' }, update: {}, create: { name: 'ValueFlow 示例公司', slug: 'valueflow-demo' } });
  const departmentNames = [['SALES','销售部'],['MARKETING','市场部'],['TECH','技术部'],['OPERATIONS','运营部'],['ADMIN','行政部']] as const;
  const departments = new Map<string, string>();
  for (const [code, name] of departmentNames) {
    const department = await prisma.department.upsert({ where: { organizationId_code: { organizationId: organization.id, code } }, update: {}, create: { organizationId: organization.id, code, name } });
    departments.set(code, department.id);
  }
  const permissionCodes = ['user:read','user:manage','department:read','department:manage','role:manage','setting:manage','audit:read','project:create','project:read','project:business-review','project:technical-review','project:executive-confirm','settlement:manage','analytics:executive'];
  for (const code of permissionCodes) await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  const roleDefinitions: Record<string, string[]> = {
    SUPER_ADMIN: ['user:read','user:manage','department:read','department:manage','role:manage','setting:manage','audit:read','project:create','project:read','project:technical-review','settlement:manage','analytics:executive'],
    OWNER: ['user:read','department:read','project:create','project:read','project:business-review','project:executive-confirm','settlement:manage','analytics:executive'],
    DEPARTMENT_HEAD: ['user:read','department:read','project:create','project:read','project:business-review','project:executive-confirm'],
    EMPLOYEE: ['user:read','department:read','project:create','project:read'],
  };
  const roles = new Map<string, string>();
  for (const [code, permissions] of Object.entries(roleDefinitions)) {
    const role = await prisma.role.upsert({ where: { organizationId_code: { organizationId: organization.id, code } }, update: {}, create: { organizationId: organization.id, code, name: code, isSystem: true } });
    roles.set(code, role.id);
    for (const permissionCode of permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permissionCode } });
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const accounts = [
    ['admin@example.com','平台管理员','TECH','SUPER_ADMIN','L4'],
    ['owner@example.com','公司负责人','ADMIN','OWNER','L4'],
    ['techhead@example.com','技术部负责人','TECH','DEPARTMENT_HEAD','L4'],
    ['employee1@example.com','示例员工','MARKETING','EMPLOYEE','L1'],
  ] as const;
  for (const [email, displayName, departmentCode, roleCode, level] of accounts) {
    const user = await prisma.user.upsert({ where: { organizationId_email: { organizationId: organization.id, email } }, update: { isDemoAccount: true, passwordHash }, create: { isDemoAccount: true, organizationId: organization.id, departmentId: departments.get(departmentCode), email, displayName, passwordHash, profile: { create: { capabilityLevel: level as CapabilityLevel } } } });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roles.get(roleCode)! } }, update: {}, create: { userId: user.id, roleId: roles.get(roleCode)! } });
  }
  const extraHeads = [['saleshead@example.com','销售部负责人','SALES'],['marketinghead@example.com','市场部负责人','MARKETING'],['operationshead@example.com','运营部负责人','OPERATIONS'],['adminhead@example.com','行政部负责人','ADMIN']] as const;
  for (const [email, displayName, departmentCode] of extraHeads) {
    const user = await prisma.user.upsert({ where: { organizationId_email: { organizationId: organization.id, email } }, update: { isDemoAccount: true, passwordHash }, create: { isDemoAccount: true, organizationId: organization.id, departmentId: departments.get(departmentCode), email, displayName, passwordHash, profile: { create: { capabilityLevel: 'L3' } } } });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roles.get('DEPARTMENT_HEAD')! } }, update: {}, create: { userId: user.id, roleId: roles.get('DEPARTMENT_HEAD')! } });
    await prisma.department.update({ where: { id: departments.get(departmentCode)! }, data: { headId: user.id } });
  }
  const skillNames = ['AI应用','TypeScript','数据分析','Python','产品设计','项目管理','销售运营','市场研究','内容运营','自动化','Excel','SQL','用户研究','视觉设计','流程优化'];
  const skills = [];
  for (const name of skillNames) skills.push(await prisma.skill.upsert({ where: { organizationId_name: { organizationId: organization.id, name } }, update: {}, create: { organizationId: organization.id, name } }));
  const departmentCodes = ['SALES','MARKETING','TECH','OPERATIONS','ADMIN'] as const;
  for (let index = 1; index <= 20; index += 1) {
    const email = `employee${index}@example.com`; const departmentCode = departmentCodes[(index - 1) % departmentCodes.length]!;
    const department = await prisma.department.findUniqueOrThrow({ where: { id: departments.get(departmentCode)! } });
    const user = await prisma.user.upsert({ where: { organizationId_email: { organizationId: organization.id, email } }, update: { isDemoAccount: true, passwordHash, departmentId: department.id, managerId: department.headId }, create: { isDemoAccount: true, organizationId: organization.id, departmentId: department.id, managerId: department.headId, email, displayName: `员工${index}`, passwordHash, profile: { create: { capabilityLevel: `L${Math.min(4, Math.floor((index - 1) / 5))}` as CapabilityLevel } } } });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roles.get('EMPLOYEE')! } }, update: {}, create: { userId: user.id, roleId: roles.get('EMPLOYEE')! } });
    for (const skill of [skills[index % skills.length]!, skills[(index + 4) % skills.length]!]) await prisma.employeeSkill.upsert({ where: { userId_skillId: { userId: user.id, skillId: skill.id } }, update: { proficiency: (index % 5) + 1 }, create: { userId: user.id, skillId: skill.id, proficiency: (index % 5) + 1 } });
    const periodStart = new Date('2026-10-01T00:00:00.000Z'); const periodEnd = new Date('2026-10-31T23:59:59.000Z');
    await prisma.employeeCapacity.upsert({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart, periodEnd } }, update: { availableHours: 20 + index }, create: { userId: user.id, periodStart, periodEnd, availableHours: 20 + index } });
  }
  const settings: Record<string, unknown> = {
    'matching.weights': { skills: 40, capability: 20, successRate: 15, similarExperience: 10, capacity: 10, reputation: 5 },
    'matching.defaults': { successRate: 50, similarExperience: 0 },
    'risk.thresholds': { yellowGap: 20, redGap: 35, yellowRiskLevel: 2, redRiskLevel: 3 },
    'execution.deadlineReminderDays': { days: [7, 3, 1] },
    'rating.thresholds': { S: 95, A: 85, B: 70, C: 60 },
    'rating.weights': { publisherBusiness: 30, departmentHeadBusiness: 30, aiTechnical: 10, ownerManagerTechnical: 10, projectManagement: 20 },
    'rating.projectManagement': { baseScore: 100, overduePenalty: 20, redSnapshotPenalty: 5, unresolvedRiskPenalty: 10 },
    'rating.highValueThreshold': 10000,
    'reputation.eventDeltas': { GRADE_S: 5, GRADE_A: 3, ON_TIME: 2, OWNER_REPLACED: -15, PROJECT_FAILED: -20, MALICIOUS_ABANDON: -20 },
    'feedback.skillVerification': { minimumContributionPercentage: 20, acceptedGrades: ['S', 'A'] },
    'feedback.capabilityProgression': { L0: 0, L1: 105, L2: 115, L3: 130, L4: 150, allowAutomaticDemotion: false },
    'ai.deliveryReviewContext': { maxProgressLogs: 20, maxRisks: 10, maxDeliveryVersions: 5, maxTextChars: 20000 },
    'ai.evaluationWorker': { attempts: 3, backoffMs: 5000 },
    'opportunity.rules': { maxOpenDays: 180, maxProposalsPerUser: 1 },
    'circle.rules': { defaultDurationDays: 30, maxMembers: 100 },
    'buff.rules': { attempts: 3, backoffMs: 5000 },
    'buff.costRules': { inputMicrosPer1k: 0, outputMicrosPer1k: 0 },
    'network.rules': { maxRangeDays: 365, maxNodes: 1000 },
    'reputation.ownerReplacementRestriction': { days: 30, levels: ['P0', 'P1'] },
    'settlement.lockDay': 1,
    'analytics.contributionWeights': { projectValue: 25, grade: 25, projectLevel: 15, contribution: 15, crossDepartment: 10, onTime: 5, aiEfficiency: 5 },
    'security.selfReviewForbidden': true,
    'intake.manualDiagnosisDefaults': { confidence: 0, businessValueScore: 50, technicalComplexityScore: 50, urgencyScore: 50, aiProjectLevel: 'P4', humanProjectLevel: 'P2', aiCapabilityLevel: 1, humanCapabilityLevel: 3, aiEstimatedHours: 2, humanEstimatedHours: 20, requiredSkills: ['待补充'] },
  };
  for (const [key, value] of Object.entries(settings)) await prisma.systemSetting.upsert({ where: { organizationId_scope_key: { organizationId: organization.id, scope: 'GLOBAL', key } }, update: { value: value as never }, create: { organizationId: organization.id, key, value: value as never } });
  const bonusRules = [
    ['P0', '500'], ['P1', '350'], ['P2', '250'], ['P3', '180'], ['P4', '120'],
  ] as const;
  const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');
  for (const [projectLevel, hourlyRate] of bonusRules) await prisma.bonusRule.upsert({
    where: { organizationId_projectLevel_effectiveFrom: { organizationId: organization.id, projectLevel, effectiveFrom } },
    update: { hourlyRate },
    create: { organizationId: organization.id, projectLevel, hourlyRate, minHours: 1, maxHours: 200, sMultiplier: 1.5, aMultiplier: 1.2, bMultiplier: 1, cMultiplier: 0.5, failMultiplier: 0, effectiveFrom },
  });

  const demoUsers = await prisma.user.findMany({
    where: { organizationId: organization.id, email: { in: ['employee1@example.com', 'employee2@example.com', 'employee3@example.com', 'employee4@example.com', 'owner@example.com'] } },
  });
  const userByEmail = new Map(demoUsers.map((user) => [user.email, user]));
  const publisher = userByEmail.get('employee1@example.com')!;
  const owner = userByEmail.get('employee2@example.com')!;
  const contributor = userByEmail.get('employee3@example.com')!;
  const secondContributor = userByEmail.get('employee4@example.com')!;
  const executive = userByEmail.get('owner@example.com')!;
  const projectStatuses = [
    'AI_TRIAGE', 'AI_COMPLETED', 'DEPARTMENT_REVIEW', 'TECH_REVIEW',
    'PUBLISHED', 'APPLICATION_OPEN', 'OWNER_ASSIGNED', 'PLANNING',
    'IN_PROGRESS', 'AT_RISK', 'DELIVERY_SUBMITTED', 'BUSINESS_ACCEPTANCE',
    'FINAL_RATING', 'CONTRIBUTION_CONFIRMATION', 'SETTLEMENT_PENDING', 'SETTLED',
    'SETTLED', 'SETTLED', 'SETTLED', 'FAILED',
  ] as const;
  const projectLevels = ['P4', 'P3', 'P2', 'P1', 'P0'] as const;
  const grades = ['S', 'A', 'B', 'C'] as const;
  const scores = { S: 97, A: 89, B: 78, C: 65 } as const;

  for (let level = 0; level <= 4; level += 1) {
    const id = `20000000-0000-4000-8000-${String(level + 1).padStart(12, '0')}`;
    const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      await prisma.project.create({
        data: {
          id,
          organizationId: organization.id,
          publisherId: publisher.id,
          publisherDepartmentId: publisher.departmentId!,
          title: `能力等级 L${level} 市场示例`,
          description: `用于验证 L${level} 能力要求、匹配解释和特殊申请审核的开放项目。`,
          businessProblem: '需要让不同能力等级员工看到可解释的匹配差异。',
          expectedResult: '市场卡片展示匹配分项、产能冲突、奖金预估和申请状态。',
          acceptanceCriteria: '申请必须填写真实信息，能力不足时进入特殊审核。',
          projectLevel: projectLevels[level]!,
          requiredCapabilityLevel: `L${level}` as CapabilityLevel,
          businessValueScore: 55 + level * 10,
          technicalComplexityScore: 30 + level * 12,
          urgencyScore: 50,
          estimatedHours: 12 + level * 8,
          approvedHours: 12 + level * 8,
          deadline: new Date('2026-12-31T00:00:00.000Z'),
          status: 'APPLICATION_OPEN',
          createdBy: publisher.id,
          requiredSkills: {
            create: [{ skillId: skills[level]!.id, weight: Math.min(5, level + 1) }],
          },
        },
      });
    }
  }

  for (let index = 0; index < projectStatuses.length; index += 1) {
    const sequence = index + 1;
    const id = `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    const status = projectStatuses[index]!;
    const projectLevel = projectLevels[index % projectLevels.length]!;
    const hasOwner = !['AI_TRIAGE', 'AI_COMPLETED', 'DEPARTMENT_REVIEW', 'TECH_REVIEW', 'PUBLISHED', 'APPLICATION_OPEN'].includes(status);
    const startedAt = hasOwner ? new Date(`2026-09-${String(Math.min(sequence, 28)).padStart(2, '0')}T01:00:00.000Z`) : null;
    const completed = ['FINAL_RATING', 'CONTRIBUTION_CONFIRMATION', 'SETTLEMENT_PENDING', 'SETTLED'].includes(status);
    await prisma.project.upsert({
      where: { id },
      update: {
        status,
        ownerId: hasOwner ? owner.id : null,
        supervisorId: hasOwner ? executive.id : null,
        startedAt,
        deliveredAt: completed ? new Date('2026-09-25T08:00:00.000Z') : null,
        completedAt: completed ? new Date('2026-09-28T08:00:00.000Z') : null,
      },
      create: {
        id,
        organizationId: organization.id,
        publisherId: publisher.id,
        publisherDepartmentId: publisher.departmentId!,
        ownerId: hasOwner ? owner.id : null,
        supervisorId: hasOwner ? executive.id : null,
        title: `示例价值项目 ${String(sequence).padStart(2, '0')}`,
        description: `用于验证 ValueFlow ${status} 状态的真实演示项目。`,
        businessProblem: '跨部门业务信息分散，重复人工处理造成效率损耗。',
        expectedResult: '形成可复用、可衡量、可追踪的业务成果。',
        acceptanceCriteria: '核心流程可运行，关键指标达到配置阈值，并留存审计记录。',
        projectLevel,
        requiredCapabilityLevel: `L${Math.min(4, Math.floor(index / 5))}` as CapabilityLevel,
        businessValueScore: 60 + (index % 5) * 8,
        technicalComplexityScore: 45 + (index % 4) * 10,
        urgencyScore: 50 + (index % 5) * 7,
        estimatedHours: 20 + sequence * 2,
        approvedHours: hasOwner ? 20 + sequence * 2 : null,
        deadline: new Date('2026-12-31T00:00:00.000Z'),
        baseBonus: hasOwner ? 3000 + sequence * 100 : null,
        finalBonus: status === 'SETTLED' ? 3600 + sequence * 100 : null,
        status,
        aiExecutionRatio: (index % 5) * 20,
        objective: '降低人工处理时间并提高跨部门协作透明度。',
        createdBy: publisher.id,
        approvedAt: hasOwner ? new Date('2026-09-01T08:00:00.000Z') : null,
        startedAt,
        deliveredAt: completed ? new Date('2026-09-25T08:00:00.000Z') : null,
        completedAt: completed ? new Date('2026-09-28T08:00:00.000Z') : null,
      },
    });
    if (hasOwner) {
      for (const [userId, role] of [[owner.id, 'OWNER'], [contributor.id, 'CONTRIBUTOR'], [secondContributor.id, 'CONTRIBUTOR']] as const) {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: id, userId } },
          update: { role },
          create: { projectId: id, userId, role, createdBy: executive.id },
        });
      }
    }
    if (status === 'SETTLED') {
      const grade = grades[index - 15]!;
      const finalScore = scores[grade];
      await prisma.projectRating.upsert({
        where: { projectId: id },
        update: { grade, finalScore },
        create: {
          projectId: id,
          publisherBusinessScore: finalScore,
          departmentHeadBusinessScore: finalScore,
          aiTechnicalScore: finalScore,
          ownerManagerTechnicalScore: finalScore,
          projectManagementScore: finalScore,
          finalScore,
          grade,
          breakdown: { source: 'seed', score: finalScore },
          requiresExecutiveConfirmation: grade === 'S' || grade === 'A',
          confirmedById: grade === 'S' || grade === 'A' ? executive.id : null,
          confirmedAt: grade === 'S' || grade === 'A' ? new Date('2026-09-29T08:00:00.000Z') : null,
          confirmationNote: grade === 'S' || grade === 'A' ? '演示数据：高价值项目已确认' : null,
        },
      });
      for (const [userId, percentage] of [[owner.id, 50], [contributor.id, 30], [secondContributor.id, 20]] as const) {
        await prisma.projectContribution.upsert({
          where: { projectId_userId_proposalVersion: { projectId: id, userId, proposalVersion: 1 } },
          update: { proposedPercentage: percentage, finalPercentage: percentage, status: 'CONFIRMED', confirmedAt: new Date('2026-09-29T09:00:00.000Z') },
          create: { projectId: id, userId, proposedById: owner.id, proposalVersion: 1, proposedPercentage: percentage, finalPercentage: percentage, status: 'CONFIRMED', confirmedAt: new Date('2026-09-29T09:00:00.000Z') },
        });
      }
    }
  }
  console.log('Seed complete. Password:', password);
}

main().finally(() => prisma.$disconnect());

