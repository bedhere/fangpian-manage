# Sanitized source archive

This repository is a public, sanitized snapshot of an existing management platform. It is a source backup, not a production deployment configuration.

## Data and configuration

- Real users, login names, employee aliases, customer companies and brands are replaced with demonstration values.
- Exported database seed rows, target amounts and embedded performance snapshots are removed or zeroed. Demonstration values must never be treated as real business records.
- Production credentials, environments, database dumps, uploads, employee workbooks, private audit reports and production probe scripts are excluded.
- Complete original Git history and deployment/data backups are held privately. This repository begins with fresh sanitized history.
- No production database, account, credential or deployment was changed by creating this archive.

## Dashboard redevelopment direction

The recently developed CommerceBoard screen is archived and abandoned as the product direction. Further work must extend the original dashboard at `apps/external-collab/client/src/App.tsx`, preserving its existing company/brand views, target management, commission controls, filters and order details. The backup itself does not switch the live dashboard.

The archived new code remains here to preserve the snapshot. Backend components may only be reused after compatibility and source-data verification. Public demonstration identities and zeroed data cannot be used for production acceptance.

## Local development

Use the existing package scripts and separate application dependency boundaries. Supply your own local configuration using example environment files. Never restore these demonstration seeds over a live database. Never place production keys or real business exports in this public repository.

## Archived technical readme

# 方片·敢想敢成

> 2026-10-10：P0、P1、P2 已逐批完成并重新验收。系统现覆盖可信 AI、反馈闭环、完整治理与洞察、机会市场、临时圈子、AI Buff、八类排行及企业价值流网络。

企业内部价值与产能流动平台。让敢想的事，被真正做成。`ValueFlow` 仅作为内部包名、数据库名与历史技术代号保留。

## 当前进度

### 团队待办（项目2能力整合）

员工端「协作 → 团队待办」或 `/tasks` 使用方片现有登录，不需要另外注册。
支持任务逐格编辑、示例公司有限公司/部门派单认领、五层子任务、进度联动、周期任务、甘特图、筛选分组、回收站、私人备忘录、艾维利日报、月度绩效及浏览器小窗。

成员、部门、权限继续在原管理端维护；小组视图对应现有部门。组织管理员维护分类维度，部门负责人维护所负责部门的标签；绩效仅本人及有管理权限的负责人可读写，最终评分只允许负责人填写。项目2导出包中的演示账号和历史任务不会自动导入。

业务数据保存在 PostgreSQL `team_work_states`，按组织隔离并在事务中串行更新。新派单和到期提醒进入原有通知中心；服务端每30秒扫描，浏览器开启通知许可后也可弹出提醒。周期任务按业务时区当天幂等生成，默认 `Asia/Shanghai`，可用 `APP_TIMEZONE` 覆盖。浏览器小窗需要保持页面打开；当前未提供独立原生桌面安装包。

团队视图源码在 `apps/team-work`，由员工端构建脚本打包到 `/team-work/`；同源消息桥复用现有认证客户端，子页面不持有或保存访问令牌。API 统一以 `/api/team-work` 为前缀。部署前应备份 PostgreSQL，再运行迁移，不执行 Seed 或数据库重置。

旧版 Phase 1–9 基线及后续 V1 纵向任务均已完成；2026-10-10 的 P0–P2 完整化批次进一步补齐可信 AI、治理、产品化体验与二期业务闭环。验收证据见 `docs/ACCEPTANCE.md`。

## 目录

```text
apps/web       员工端（端口 3000）
apps/admin     管理端（端口 3002）
apps/api       NestJS API（端口 3001）
apps/worker    BullMQ Worker
packages/domain 纯领域规则
packages/db     Prisma 共享入口
packages/auth   身份契约
packages/config 环境校验
packages/contracts API 契约
packages/ui      方片品牌设计令牌与共享组件
prisma          Schema、Migration、Seed
docs            产品与技术文档
```

## 本地启动

要求 Node.js 22+、pnpm 11+、Docker Desktop。

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis minio
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

当前 Windows 工作区的 pnpm 虚拟仓库固定在 `F:/value-flow-virtual-store`，依赖仍只写入 F 盘；Docker 构建会改用容器内 `.pnpm`。安装脚本仅放行 Prisma、Argon2、esbuild、unrs-resolver 与 BullMQ 原生优化依赖。

## Docker 全栈启动

```powershell
# 当前路径包含中文时，Docker BuildKit 有已知的会话头编码问题；Windows 下使用兼容后端
$env:DOCKER_BUILDKIT='0'
docker compose up --build -d
```

当前 `.env` 的宿主机端口为员工端 `http://localhost:3100`、管理端 `http://localhost:3102`、API 健康检查 `http://localhost:3101/api/health`；容器默认端口仍为 3000/3002/3001。MinIO 控制台为 `http://localhost:9001`。迁移和开发 Seed 由一次性 `migrate` 服务先执行，成功后 API/Worker 才启动。端口可通过 `WEB_PORT_HOST`、`API_PORT_HOST`、`ADMIN_PORT_HOST` 等环境变量修改，更换后需重新构建 Web/Admin 镜像。

## API

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/workspace/bootstrap`（当前身份、权限导航、示例公司有限公司计数、推进事项与通知）
- `GET /api/users/me`（Bearer Access Token）
- `POST /api/requests`（创建需求草稿）
- `GET /api/requests/:id`（需求、AI 会话与关联项目）
- `POST /api/requests/:id/diagnose`（结构化诊断与路线选择）
- `POST /api/requests/:id/confirm-project`（人工路线确认项目草稿）
- `POST /api/ai-workspaces/:id/messages`（追加不可覆盖的工作区消息）
- `POST /api/ai-workspaces/:id/complete`（固化 AI 成果并完成需求）
- `GET /api/knowledge-assets`（已发布资产、本人资产及当前权限对应的审核队列）
- `POST /api/knowledge-assets`（创建知识资产草稿）
- `POST /api/knowledge-assets/:id/submit`（提交业务审核）
- `POST /api/knowledge-assets/:id/reviews`（业务/技术独立审核）
- `POST /api/projects`
- `GET /api/projects?view=MINE|PUBLISHED|ALL&page=1&pageSize=20`（分页项目列表）
- `GET /api/projects/:id`
- `POST /api/projects/:id/ai-triage`
- `POST /api/projects/:id/business-review`
- `POST /api/projects/:id/technical-review`
- `POST /api/projects/:id/resubmit`（退回后由发布人按版本重新提交）
- `GET /api/reviews/business`（当前部门业务审核队列）
- `GET /api/reviews/technical`（独立技术审核队列）
- `GET /api/market/projects`（可按关键词、项目等级、能力要求筛选；返回匹配分项、产能冲突、预估奖金和本人申请状态）
- `POST /api/projects/:id/apply`（申请动机、预计工时和相关经验必填）
- `GET /api/projects/:id/applications`（审核人比较候选人）
- `POST /api/projects/:projectId/applications/:applicationId/decide`（批准、特殊批准或拒绝）
- `POST /api/projects/:id/assign-owner`
- `POST /api/projects/:id/members`
- `POST /api/capacity`
- `GET /api/capacity/me`
- `GET /api/employees/:id/skills`
- `POST /api/employees/me/skills`
- `POST /api/projects/:id/milestones`
- `GET /api/projects/:id/execution`（计划、团队、进展、健康、整改聚合视图）
- `POST /api/projects/:id/plan`（保存新的执行计划版本，里程碑权重合计必须为 100%）
- `POST /api/projects/:id/plan/submit`
- `POST /api/projects/:id/plan/confirm`（独立主管确认）
- `POST /api/projects/:id/invitations`
- `POST /api/projects/invitations/:invitationId/respond`
- `POST /api/projects/:id/start`
- `POST /api/projects/:id/progress`
- `GET /api/projects/:id/timeline`
- `POST /api/projects/:id/risk-actions`
- `POST /api/projects/:id/replace-owner`
- `POST /api/projects/:id/delivery-upload-url`
- `POST /api/projects/:id/deliveries`
- `GET /api/projects/:id/deliveries`
- `POST /api/projects/:id/delivery-ai-review`
- `POST /api/projects/:id/delivery-ai-review/run`（调用 Provider，可重试）
- `GET /api/projects/:id/delivery-workspace`（版本、AI、验收、评分和允许操作）
- `GET /api/projects/delivery-review-queue`（当前用户的交付验收任务）
- `POST /api/projects/:id/acceptances`
- `POST /api/projects/:id/executive-confirmation`
- `POST /api/projects/:id/contributions`
- `GET /api/projects/:id/contribution-workspace`（方案版本、争议、仲裁和允许操作）
- `POST /api/projects/:id/contributions/:contributionId/respond`
- `POST /api/projects/:id/contribution-arbitration`
- `GET /api/bonuses/me`
- `POST /api/settlements/lock`
- `GET /api/settlements?month=YYYY-MM`（授权月结管理）
- `POST /api/settlements/:id/pay`
- `GET /api/profiles/:id`
- `PATCH /api/profiles/me`
- `GET /api/skills`
- `GET /api/analytics/rankings`
- `GET /api/analytics/departments`
- `GET /api/analytics/capacity`
- `GET /api/analytics/executive-dashboard`
- `GET/PATCH /api/admin/settings`
- `GET /api/admin/setting-definitions`
- `GET/POST /api/admin/users`、`PATCH /api/admin/users/:id`
- `GET/POST /api/admin/departments`、`PATCH /api/admin/departments/:id`
- `GET /api/admin/roles`、`GET /api/admin/permissions`、`PATCH /api/admin/roles/:id/permissions`
- `GET /api/admin/ai-configuration`、`GET /api/admin/health`
- `GET /api/admin/audit-logs`
- `GET /api/notifications`
- `GET /api/notifications/stream`（SSE）
- `GET/POST /api/opportunities`、`POST /api/opportunities/:id/follow|proposals|convert`
- `GET/POST /api/circles`、加入审核、邀请、讨论、关闭与知识沉淀接口
- `GET/POST /api/ai-buffs`、版本、发布与幂等运行接口
- `GET /api/insights/value-network`（授权过滤的企业价值网络）

Refresh Token 只保存在 `HttpOnly; SameSite=Lax; Path=/api/auth` Cookie 中，每次使用后立即撤销并换发；检测到重用时撤销同一 token family。Access Token 只保存在浏览器内存，页面刷新时通过 Cookie 自动恢复。密码使用 Argon2id 哈希。

需求诊断默认调用 OpenAI-compatible `/chat/completions`。通过 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`AI_MAX_ATTEMPTS` 和 `AI_TIMEOUT_MS` 配置；未配置、超时或输出未通过严格 Schema 时，需求仍保留为草稿并开放人工继续。人工路线的评分、等级、能力与工时默认值来自 `SystemSetting.intake.manualDiagnosisDefaults`，不在界面或服务中写死。

## 开发示例员工1548

统一密码仅用于开发 Seed：`DEMO_ONLY_ChangeMe_2026!`

| 账号 | 角色 |
|---|---|
| admin@example.com | SUPER_ADMIN |
| owner@example.com | OWNER |
| techhead@example.com | DEPARTMENT_HEAD |
| employee1@example.com | EMPLOYEE |

Seed 还会创建 5 个部门、5 名部门负责人、20 名员工、15 项技能、20 个覆盖主要业务状态的演示项目，以及 5 个不会被后续 Seed 覆盖的 L0–L4 开放市场样本；其中结算项目包含 S/A/B/C 四档评分和三人贡献分配。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @value-flow/api test:e2e
pnpm build
docker compose config --quiet
```

最近一次 P2 验收（2026-10-10）：26 个前向迁移全部应用，Schema 差异为零，Seed 连续两次成功；`lint`、`typecheck`、`build` 均 12/12，Turbo tests 17/17，API 95、Web 41、Admin 5、Worker 10、Domain 56、AI 13，API E2E 11/11。

最近一次 Task 6 验收（2026-10-08）：执行计划版本、主管确认、团队邀请、追加式进展、配置化健康状态、整改与负责人更换闭环已完成。lint 12/12、typecheck 12/12、test 17/17 Turbo tasks、build 12/12；API 单元 48、Web 26、Worker 2、Domain 49、API E2E 9/9。空库 13 个迁移及两次幂等 Seed 通过，稳定为 1 个组织、27 个用户、14 项系统配置和 25 个项目。Docker 全栈重建成功，Web/Admin/API 健康，3100/3102/3101 均返回 HTTP 200。

最近一次 Task 7 验收（2026-10-08）：交付版本与验收按版本永久保留，MinIO 对象键实施组织/项目双重隔离；真实 AI Reviewer 支持重试、失败事实和人工兜底，三方验收角色由服务端分配，评分权重/阈值配置化，高价值结果由独立高管确认。员工端新增黄白黑交付工作台与 `/reviews/delivery` 队列。lint 12/12、typecheck 12/12、test 17/17 Turbo tasks、build 12/12；API 单元 53、Web 27、AI 7、Worker 2、Domain 49、API E2E 9/9。空库 14 个迁移及两次幂等 Seed 通过，稳定为 1 个组织、27 个用户、14 项系统配置和 25 个项目。

最近一次 Task 8 验收（2026-10-08）：贡献方案版本化且不可覆盖，旧版本响应被拒绝；确认、争议、原始/最终分配和仲裁全部可追溯。示例公司有限公司奖金流水支持月份/状态筛选和计算解释，授权月结管理支持幂等锁定与发放。lint 12/12、typecheck 12/12、test 17/17 Turbo tasks、build 12/12；API 单元 56、Web 29、Worker 3、Domain 49、API E2E 9/9。空库 15 个迁移及两次幂等 Seed 通过，稳定为 1 个组织、27 个用户、14 项系统配置和 25 个项目。

最近一次 Task 9 验收（2026-10-08）：员工可维护自己的简介与时区、查看技能/成长/项目/奖金事实，周期产能拒绝重叠区间；七类实名排行、部门聚合、产能地图和老板驾驶舱全部直接聚合真实业务数据，老板驾驶舱继续受 `analytics:executive` 权限保护。员工端新增 `/profile`、`/capacity`、`/rankings` 和 `/executive` 黄白黑响应式页面。排行不维护易失真的派生缓存，因此无需空转刷新任务，数据变更后下一次查询即反映最新事实。lint 12/12、typecheck 12/12、test 17/17 Turbo tasks、build 12/12；API 单元 59、Web 30、Worker 3、Domain 49、API E2E 9/9。空库 15 个迁移及两次幂等 Seed 通过，稳定为 1 个组织、27 个用户、14 项系统配置和 25 个项目。

最近一次 Task 10 验收（2026-10-08）：独立 Admin 已形成组织成员、部门、角色权限、类型化规则、AI 配置、通知、审计和依赖健康路由。成员支持搜索分页、Argon2id 密码创建、暂停/恢复与禁用软删除；末位超级管理员、部门环和权限升级由服务端拒绝。AI 密钥只报告配置状态，规则由显式注册表校验并保留版本。lint/typecheck/build 均 12/12，tests 17/17，API 67、Admin 5、Web 30、Domain 52、E2E 9/9 通过。

最终 Task 11 验收（2026-10-08）：主生命周期及次要场景 E2E、390/768/1440 响应式检查、安全审查、依赖审计、数据库查询计划和无旧缓存 Docker 重建全部通过。修复了认证限速未实际启用的问题，移除登录页预填密码并增加安全响应头；生产依赖无 high/critical。16 个迁移全部应用，Seed 连续执行两次成功。最终 `lint`、`typecheck`、`build` 均为 12/12，`test` 为 17/17；API 68、Web 30、Admin 5、Domain 52、Worker 3、AI 7、E2E 9/9。Web/API/Admin/MinIO 均返回 HTTP 200，全部 Compose 服务健康或正常运行。

## AI 与对象存储

AI Provider 通过 `packages/ai` 的 OpenAI-compatible Gateway 与严格 Zod Schema 接入，业务模块不得直接调用模型 SDK。MinIO 使用 S3 兼容接口，本地端口为 9000，控制台为 9001；文件交付先从 API 获取 15 分钟有效的签名上传地址，再由浏览器直传对象存储。

## 生产建议

生产环境变量会在 API 启动时按 Schema 校验，缺少或过短的 JWT 密钥会直接拒绝启动。部署时必须替换 Compose 示例中的 JWT、数据库与 MinIO 密钥，启用 HTTPS、收紧 CORS、使用托管 PostgreSQL/Redis/S3，并接入集中日志、指标、备份、镜像扫描与密钥管理。
## P1 已交付能力（2026-10-10）

- AI 交付评审使用完整需求、计划、里程碑、进展、风险和版本上下文，并通过 BullMQ Worker 异步执行。
- 管理端支持成员、部门、角色、权限和密码重置的审计治理；系统角色和最后超级管理员受保护。
- `/bonuses` 提供示例公司有限公司奖金与组织透明账本；`/knowledge` 支持资产类型、来源链接和真实引用计数；`/insights` 提供公司级经营洞察。
- 新增 `GET /api/insights/company`、`GET /api/insights/departments/:id`、`GET /api/insights/employees/:id` 与 `GET /api/bonuses/transparent`。

Production-derived acceptance fixtures and private operational probes are excluded. Some archived scripts reference these private-only checks. This sanitized snapshot is not a verified production release.
