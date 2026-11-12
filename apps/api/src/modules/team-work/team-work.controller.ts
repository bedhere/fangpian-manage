import { BadRequestException, ForbiddenException, Body, Controller, Get, Param, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from './auth/auth.guard.js';
import { publicUser, type PublicUser, type UserPrefs } from './domain/types.js';
import { store } from './store/index.js';
import { TeamWorkInterceptor } from './team-work.interceptor.js';

export function organizationView() {
  const db = store.db;
  return { departments: db.departments, groups: db.groups,
    users: db.users.filter(u => u.state === 'active' && !u.isDemoAccount).map(publicUser), dims: db.settings.dims };
}

@Controller('team-work')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TeamWorkInterceptor)
export class TeamWorkController {
  @Get('me') me(@CurrentUser() me: PublicUser) { return { user: me }; }
  @Get('org') org() {
    return organizationView();
  }
  @Patch('settings') async settings(@CurrentUser() me: PublicUser, @Body() input: { dims: Array<{ id: string; name: string }> }) {
    if (me.role !== 'admin' || me.managedDepartmentIds) throw new ForbiddenException('分类维度由组织管理员维护');
    if (!Array.isArray(input?.dims) || input.dims.length < 2 || input.dims.length > 12) throw new BadRequestException('分类维度须为2至12项');
    const dims = input.dims.map(d => ({ id: String(d?.id || ''), name: String(d?.name || '').trim() }));
    if (dims.some(d => !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(d.id) || d.id === 'constructor' || !d.name || d.name.length > 24) ||
      new Set(dims.map(d => d.id)).size !== dims.length || !dims.some(d => d.id === 'cat') || !dims.some(d => d.id === 'type')) throw new BadRequestException('保留板块和类型，分类编号须唯一，名称最多24字');
    await store.update(db => { db.settings.dims = dims; });
    return { ok: true };
  }
  @Patch('groups/:id/tags') async groupTags(@CurrentUser() me: PublicUser, @Param('id') id: string,
    @Body() input: { dimId: string; tags: string[] }) {
    if (me.role !== 'admin' || (me.managedDepartmentIds && !me.managedDepartmentIds.includes(id))) throw new ForbiddenException('只能管理负责部门的标签');
    const group = store.db.groups.find(g => g.id === id);
    if (!group || !store.db.settings.dims.some(d => d.id === input?.dimId)) throw new BadRequestException('部门或分类不存在');
    if (!Array.isArray(input.tags) || input.tags.length > 100 || input.tags.some(t => typeof t !== 'string' || t.length > 60)) throw new BadRequestException('标签最多100项，每项最多60字');
    const tags = [...new Set(input.tags.map(t => t.trim()).filter(Boolean))];
    await store.update(db => {
      db.settings.groupTags ??= {};
      db.settings.groupTags[id] = { ...db.settings.groupTags[id], [input.dimId]: tags };
      group.dimTags[input.dimId] = tags;
      if (input.dimId === 'cat') group.categories = tags;
      if (input.dimId === 'type') group.types = tags;
    });
    return { ok: true };
  }
  @Patch('prefs') async prefs(@CurrentUser() me: PublicUser, @Body() input: { prefs?: UserPrefs } & UserPrefs) {
    const patch = input.prefs ?? input;
    const allowed = ['view', 'time', 'prio', 'cat', 'type', 'groupBy', 'sort', 'showDone', 'chart', 'dims'];
    if (JSON.stringify(patch).length > 8000) throw new BadRequestException('偏好设置过大');
    const safe = Object.fromEntries(Object.entries(patch).filter(([key, v]) => allowed.includes(key) &&
      (typeof v === 'string' || typeof v === 'boolean' || key === 'dims')));
    await store.update(db => { const u = db.users.find(u => u.id === me.id)!; u.prefs = { ...u.prefs, ...safe }; });
    return { user: publicUser(store.db.users.find(u => u.id === me.id)!) };
  }
  @Patch('profile') async profile(@CurrentUser() me: PublicUser, @Body() input: { avatarEmoji?: string | null; avatarColor?: string | null }) {
    if (Object.keys(input).some(k => !['avatarEmoji', 'avatarColor'].includes(k))) throw new BadRequestException('姓名与账号请在方片示例公司有限公司设置中修改');
    if (input.avatarEmoji && (typeof input.avatarEmoji !== 'string' || input.avatarEmoji.length > 16)) throw new BadRequestException('头像文字过长');
    if (input.avatarColor && !/^#[0-9a-fA-F]{6}$/.test(input.avatarColor)) throw new BadRequestException('头像颜色无效');
    await store.update(db => { const u = db.users.find(u => u.id === me.id)!;
      if (input.avatarEmoji !== undefined) u.avatarEmoji = input.avatarEmoji;
      if (input.avatarColor !== undefined) u.avatarColor = input.avatarColor;
    });
    return { user: publicUser(store.db.users.find(u => u.id === me.id)!) };
  }
}
