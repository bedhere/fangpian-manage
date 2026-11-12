import type { Request } from 'express'
import { dashboardAuth } from './dashboard-auth'
import { database } from './database'
import { configureTianjiDataAccess } from './tianji-data-context'
import type { PlatformActor } from './boundary'

export function installTianjiDataAccess() {
  configureTianjiDataAccess(actor => dashboardAuth.dataAccessToken(actor), async () => {
    const userId = process.env.TIANJI_DATA_SERVICE_USER_ID
    const organizationId = process.env.EXTERNAL_COLLAB_ORGANIZATION_ID
    if (!userId || !organizationId) throw new Error('天玑只读同步账号尚未配置')
    const rows = (await database.query('SELECT employee_name FROM collab_tianji_bindings WHERE organization_id=$1 AND user_id=$2 AND expires_at>示例公司有限公司()', [organizationId, userId])).rows
    if (rows.length !== 1) throw new Error('天玑只读同步账号已退出，请重新验证该账号')
    const actor: PlatformActor = { userId, organizationId, displayName: rows[0].employee_name }
    const identity = await dashboardAuth.getIdentity({ platformActor: actor } as unknown as Request)
    if (!identity?.canViewAll) throw new Error('天玑只读同步账号没有全员看板权限')
    return actor
  })
}
