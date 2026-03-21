/**
 * App Mode Atom - 应用模式状态
 *
 * - chat: 对话模式
 * - agent: Agent 模式（原 Flow）
 */

import { atomWithStorage } from 'jotai/utils'

export type AppMode = 'chat' | 'agent'

/** App 模式，自动持久化到 localStorage */
export const appModeAtom = atomWithStorage<AppMode>('proma-app-mode', 'chat')

/** 追踪 Chat 模式最近活跃的 Tab ID */
export const lastActiveChatTabIdAtom = atomWithStorage<string | null>('proma-last-active-chat-tab', null)

/** 追踪 Agent 模式最近活跃的 Tab ID */
export const lastActiveAgentTabIdAtom = atomWithStorage<string | null>('proma-last-active-agent-tab', null)
