import * as XLSX from 'xlsx'
import { tianji } from '../../platform/tianji'

const ROSTER_PATH = '/api/admin/organization/roster/getRosterList'
const SALES_DEPARTMENT_ID = 9
const ROSTER_PAGE_SIZE = 10
const ROSTER_MAX_PAGES = 100
const ACTIVE_STATUS = 1
const CUSTOMER_POSITION_KEYWORD = '对客'
const DEVELOPER_POSITION_KEYWORD = '开发'

interface RosterPosition {
  id: number
  position_name: string
}

interface RosterEmployee {
  id: number
  employee_name: string
  employee_flower_name: string | null
  department_name: string | null
  status: number
  positions: RosterPosition[] | null
}

export type SalesRosterRole = '开发' | '对客'

export interface SalesRosterRow {
  姓名: string
  花名: string
  部门: string
  岗位: SalesRosterRole
}

export interface SalesRosterSnapshot {
  rows: SalesRosterRow[]
  developerCount: number
  customerCount: number
  rosterTotal: number
}

function classifyRole(positions: RosterPosition[] | null): SalesRosterRole | null {
  const names = (positions ?? []).map((position) => position.position_name ?? '')
  if (names.some((name) => name.includes(DEVELOPER_POSITION_KEYWORD))) return '开发'
  if (names.some((name) => name.includes(CUSTOMER_POSITION_KEYWORD))) return '对客'
  return null
}

async function fetchActiveSalesRoster(): Promise<{ employees: RosterEmployee[]; total: number }> {
  const employees: RosterEmployee[] = []
  let total = 0
  for (let page = 1; page <= ROSTER_MAX_PAGES; page++) {
    const response = await tianji.call<RosterEmployee>(ROSTER_PATH, {
      page,
      pageSize: ROSTER_PAGE_SIZE,
      status: ACTIVE_STATUS,
      dept_id: SALES_DEPARTMENT_ID,
    })
    const list = (response?.data?.list ?? []) as RosterEmployee[]
    total = Number(response?.data?.count ?? response?.data?.total ?? total)
    employees.push(...list)
    if (list.length === 0 || employees.length >= total) break
  }
  if (total === 0) throw new Error('花名册返回 0 人, 已放弃本次更新, 避免清空名单')
  if (employees.length !== total) {
    throw new Error(`花名册分页不完整: 应有 ${total} 人, 实际拉到 ${employees.length} 人, 已放弃本次更新`)
  }
  return { employees, total }
}

export async function buildSalesRosterSnapshot(): Promise<SalesRosterSnapshot> {
  const { employees, total } = await fetchActiveSalesRoster()
  const rows: SalesRosterRow[] = []
  for (const employee of employees) {
    const role = classifyRole(employee.positions)
    if (!role) continue
    rows.push({
      姓名: employee.employee_name ?? '',
      花名: employee.employee_flower_name || '—',
      部门: employee.department_name || '',
      岗位: role,
    })
  }
  rows.sort((a, b) => {
    if (a.岗位 !== b.岗位) return a.岗位 === '开发' ? -1 : 1
    return a.姓名.localeCompare(b.姓名, 'zh-Hans-CN')
  })
  return {
    rows,
    developerCount: rows.filter((row) => row.岗位 === '开发').length,
    customerCount: rows.filter((row) => row.岗位 === '对客').length,
    rosterTotal: total,
  }
}

export function buildSalesRosterXlsx(rows: SalesRosterRow[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: ['姓名', '花名', '部门', '岗位'] })
  sheet['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 10 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '商务对客开发名单')
  return XLSX.write(book, { type: '示例品牌', bookType: 'xlsx' })
}
