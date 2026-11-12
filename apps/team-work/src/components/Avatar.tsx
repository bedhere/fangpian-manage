import type { Role, User } from '../domain/types'

/**
 * 头像 —— 固定就是「角色底色 + 姓名首字」: 负责人紫底、普通成员黄底。
 * 以前还能自己选颜色/emoji, 现在统一了 (头像不再是个可配置项, 一眼就能分清是谁、是什么角色)。
 */
const FALLBACK = ['#6d8bff', '#9b6dff', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#f472b6']

function hashColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return FALLBACK[h % FALLBACK.length]
}

export function Avatar({
  name,
  role,
  size = 24,
  title,
}: {
  name: string
  role?: Role
  size?: number
  title?: string
}) {
  const label = (name || '?').trim().slice(0, 1)
  const background = role ? (role === 'admin' ? '#8b5cf6' : '#eab308') : hashColor(name || '?')
  const fg = role ? (role === 'admin' ? '#ffffff' : '#3f2d00') : '#ffffff'
  return (
    <span
      className="avatar"
      title={title || name}
      style={{ width: size, height: size, background, color: fg, fontSize: Math.round(size * 0.44) }}
    >
      {label}
    </span>
  )
}

/** 传一个用户对象就用这个, 少写几个字段 */
export function UserAvatar({
  user,
  size = 24,
  title,
}: {
  user?: Pick<User, 'name' | 'role'> | null
  size?: number
  title?: string
}) {
  if (!user) return null
  return <Avatar name={user.name} role={user.role} size={size} title={title} />
}
