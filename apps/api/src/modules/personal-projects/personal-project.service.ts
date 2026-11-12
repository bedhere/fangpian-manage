import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { CreatePersonalProjectDto, CreatePersonalTaskDto, CreatePersonalUpdateDto, UpdatePersonalProjectDto, UpdatePersonalTaskDto } from './personal-project.dto.js';

const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : new Date(value));

/** Employees' own projects: private to the owner, with tasks and a progress log. */
@Injectable()
export class PersonalProjectService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  list(actor: RequestUser) {
    return this.prisma.personalProject.findMany({
      where: { organizationId: actor.organizationId, ownerId: actor.id },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: { tasks: { select: { done: true } }, updates: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
  }

  async get(actor: RequestUser, id: string) {
    const project = await this.prisma.personalProject.findFirst({
      where: { id, organizationId: actor.organizationId, ownerId: actor.id },
      include: { tasks: { orderBy: [{ done: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }, updates: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    if (!project) throw new NotFoundException('项目不存在');
    return project;
  }

  async create(actor: RequestUser, input: CreatePersonalProjectDto) {
    const tasks = (input.tasks ?? []).map((title) => title.trim()).filter(Boolean);
    const project = await this.prisma.personalProject.create({
      data: {
        organizationId: actor.organizationId,
        ownerId: actor.id,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        startDate: toDate(input.startDate) ?? null,
        dueDate: toDate(input.dueDate) ?? null,
        status: 'PLANNING',
        tasks: { create: tasks.map((title, index) => ({ title, sortOrder: index })) },
      },
    });
    return this.get(actor, project.id);
  }

  async update(actor: RequestUser, id: string, input: UpdatePersonalProjectDto) {
    const before = await this.get(actor, id);
    const progress = input.status === 'DONE' ? 100 : input.progress;
    await this.prisma.personalProject.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        status: input.status ?? (progress !== undefined && progress > 0 && before.status === 'PLANNING' ? 'IN_PROGRESS' : undefined),
        progress,
        startDate: toDate(input.startDate),
        dueDate: toDate(input.dueDate),
      },
    });
    const after = await this.get(actor, id);
    return after;
  }

  async remove(actor: RequestUser, id: string) {
    await this.get(actor, id);
    await this.prisma.personalProject.delete({ where: { id } });
    return { id };
  }

  async addTask(actor: RequestUser, id: string, input: CreatePersonalTaskDto) {
    const project = await this.get(actor, id);
    await this.prisma.personalProjectTask.create({ data: { projectId: id, title: input.title.trim(), dueDate: toDate(input.dueDate) ?? null, sortOrder: project.tasks.length } });
    return this.syncProgress(actor, id);
  }

  async updateTask(actor: RequestUser, id: string, taskId: string, input: UpdatePersonalTaskDto) {
    const project = await this.get(actor, id);
    if (!project.tasks.some((task) => task.id === taskId)) throw new NotFoundException('任务不存在');
    await this.prisma.personalProjectTask.update({ where: { id: taskId }, data: { title: input.title?.trim(), done: input.done, dueDate: toDate(input.dueDate) } });
    return this.syncProgress(actor, id);
  }

  async removeTask(actor: RequestUser, id: string, taskId: string) {
    const project = await this.get(actor, id);
    if (!project.tasks.some((task) => task.id === taskId)) throw new NotFoundException('任务不存在');
    await this.prisma.personalProjectTask.delete({ where: { id: taskId } });
    return this.syncProgress(actor, id);
  }

  /** Logs a progress note; an explicit percentage also updates the project. */
  async addUpdate(actor: RequestUser, id: string, input: CreatePersonalUpdateDto) {
    const project = await this.get(actor, id);
    await this.prisma.personalProjectUpdate.create({ data: { projectId: id, content: input.content.trim(), progress: input.progress ?? null } });
    if (input.progress !== undefined) {
      await this.prisma.personalProject.update({
        where: { id },
        data: { progress: input.progress, status: input.progress >= 100 ? 'DONE' : project.status === 'PLANNING' || project.status === 'DONE' ? 'IN_PROGRESS' : undefined },
      });
    } else {
      await this.prisma.personalProject.update({ where: { id }, data: { updatedAt: new Date() } });
    }
    const after = await this.get(actor, id);
    return after;
  }

  /** With a checklist, progress follows the share of finished tasks. */
  private async syncProgress(actor: RequestUser, id: string) {
    const project = await this.get(actor, id);
    if (project.tasks.length) {
      const done = project.tasks.filter((task) => task.done).length;
      const progress = Math.round((done / project.tasks.length) * 100);
      const status = progress === 100 ? 'DONE' : project.status === 'DONE' || (project.status === 'PLANNING' && done > 0) ? 'IN_PROGRESS' : project.status;
      if (progress !== project.progress || status !== project.status) {
        await this.prisma.personalProject.update({ where: { id }, data: { progress, status } });
      }
    }
    return this.get(actor, id);
  }
}
