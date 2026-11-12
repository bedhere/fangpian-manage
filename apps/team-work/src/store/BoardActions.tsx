import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** 看板上那些「顶栏按钮」要做的事: 由 BoardView 注册, 顶栏调用 */
export interface BoardActions {
  /** 导出今日 / 本周 / 本期工作 (按当前视图与筛选) */
  exportWork: (scope: 'today' | 'week' | 'month') => void
}

type Ctx = {
  actions: BoardActions | null
  register: (a: BoardActions | null) => void
}

const BoardActionsCtx = createContext<Ctx>({ actions: null, register: () => undefined })

export function BoardActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<BoardActions | null>(null)
  return <BoardActionsCtx.Provider value={{ actions, register: setActions }}>{children}</BoardActionsCtx.Provider>
}

/** 顶栏用: 拿到看板注册上来的动作 */
export function useBoardActions() {
  return useContext(BoardActionsCtx).actions
}

/**
 * BoardView 用这个把动作注册给顶栏。
 * 具体实现放在 ref 里 (顶栏拿到的永远是最新的那份), 只在 deps 变化时才重新注册,
 * 否则每次渲染都 setState 会死循环。
 */
export function useRegisterBoardActions(actions: BoardActions, deps: unknown[]) {
  const { register } = useContext(BoardActionsCtx)
  const ref = useRef(actions)
  ref.current = actions
  useEffect(() => {
    register({
      exportWork: (s) => ref.current.exportWork(s),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
