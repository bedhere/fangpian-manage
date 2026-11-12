# 示例开发10别名组业绩看板取数逻辑

本规则适用于示例开发10别名组看板中的两位人员：

| 人员 | 员工 ID | 部门 | 业绩类型 |
| --- | ---: | ---: | --- |
| 示例开发01 | `275` | 示例开发10别名组，`dept_id=187` | 开发，`performance_type=develop` |
| 示例开发10 | `472` | 示例开发10别名组，`dept_id=187` | 开发，`performance_type=develop` |

两人的看板结构均为：发布、成单、结款三个独立版块；每个版块展示总业绩、十点半、自孵（不包含十点半）、签约小红书、签约抖音、签约视频号、外采业绩、外采单数。

## 一、方片月

- 不能按自然月取数，必须使用天玑方片月。
- 当前看板：本月为 2026 年方片月 9 月，`month_id=148`，区间 `[1787414400,1790438400)`，即 2026-08-23 至 2026-09-26。
- 上月为 2026 年方片月 8 月，`month_id=147`，区间 `[1784995200,1787414400)`，即 2026-07-26 至 2026-08-22。
- 订单时间筛选使用半开区间，结束时间不包含；订单接口的区间参数使用字符串形式 `"start,end"`，不要传时间戳数组。
- 更新其他月份时，先查询方片月配置接口拿到真实 `start_date/end_date` 和 `month_id`，不要自行推算自然月。

## 二、商务看板指标

总业绩和三个平台签约业绩都要在目标版块对应的业绩类型下单独查询，不能用分项加总反推总业绩。

### 1. 总业绩与平台业绩

接口：`/api/admin/statOrderRevenue/getEmployeeRevenue`

固定参数：

- `year_id=2026`
- `month_id=147` 或 `148`
- `performance_type=develop`
- `employee_id=275` 或 `472`
- `revenue_type=publish`（发布）、`order`（成单）、`settlement`（结款）
- `is_foreign_broker=0`

平台参数：

- 全部平台：`platform_id=0`，取员工行的 `revenue` 作为总业绩。
- 小红书：`platform_id=1`。
- 抖音：`platform_id=2`。
- 视频号：`platform_id=5`。

读取 `data.employee_revenue` 中对应员工 ID 的 `revenue`；不能因为三个平台之和不同就自行修正总业绩，也不能把发布结果复制到成单或结款。

### 2. 十点半

接口：`/api/admin/statOrderRevenue/getSelfGenerateHalfPastTenRevenue`

按 `dept_id=187`、`month_id`、员工 ID、对应 `revenue_type` 取员工行的 `revenue`。不能用总自孵接口代替十点半。

### 3. 自孵（不包含十点半）

接口：`/api/admin/statOrderRevenue/getSelfGenerateBusinessEmployeeRevenue`

按 `year_id=2026`、`month_id`、`dept_id=187`、员工 ID、对应 `revenue_type`、`performance_type=develop`、`platform_id=0`、`is_foreign_broker=0` 取员工行的 `revenue`。

必须取示例公司有限公司员工行，不能使用 `getSelfGenerateOrdertypeRevenue` 的部门聚合值，也不能把十点半再从部门值中自行相减。

## 三、外采指标

外采不从商务看板分项相加，必须单独查询订单列表：`/api/admin/order/getOrderList`。

固定筛选：

- `order_type=3`，外采订单。
- `payment_business_employee_id=275` 或 `472`，按结款商务筛选；不要改用成单商务字段。
- 发布、结款使用 `payment_time`；成单使用 `order_date`。
- 按方片月完整半开区间查询。
- 必须完整分页读取所有结果，不能只取第一页或在页大小异常时直接把空结果当成 0。
- 在应用内保留订单状态 `100/200/300`（等待发布、等待结款、已结款），排除 `-400` 等取消状态和草稿。
- 有效订单即使 `income_money` 为负数，也必须计入；不能按金额正负排除。
- 外采业绩 = 有效订单的 `income_money`（公司总收益/公司收益）求和。
- 外采单数 = 有效订单数量。

时间字段对应关系：

| 看板版块 | 时间字段 | 含义 |
| --- | --- | --- |
| 发布 | `payment_time` | 结款时间落在方片月内 |
| 成单 | `order_date` | 成单时间落在方片月内 |
| 结款 | `payment_time` | 结款时间落在方片月内 |

## 四、更新顺序与校验

1. 先确认更新人员：示例开发01 `275` 或示例开发10 `472`。
2. 再确认版块：发布、成单或结款；`revenue_type` 必须跟版块一致。
3. 再确认本月/上月对应的 `month_id` 和方片月区间。
4. 商务指标逐项调用接口，不能复制其他版块的静态值。
5. 外采单独按订单列表完整分页，先按状态筛选，再加总 `income_money` 和计数。
6. 只更新用户指定的人员、版块、月份和指标，其他人员及版块保持不变。
7. 更新后应复核天玑页面显示的订单数和公司总收益；如数量对不上，优先检查分页、员工字段类型、时间区间格式和状态筛选。

## 五、代码位置

- 前端静态看板数据：`client/src/App.tsx`。
- 后端订单取数和缓存：`server/modules/dashboard/dashboard.service.ts`。
- 示例开发01别名细则：`docs/muyuan-publish-metrics.md`。
- 示例开发10细则：`docs/liu-guangcun-metrics.md`。
- 方片月日历：`docs/fangpian-month-calendar-2026.md`。
