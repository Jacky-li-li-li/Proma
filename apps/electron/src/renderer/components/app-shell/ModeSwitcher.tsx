/**
 * ModeSwitcher - Chat/Agent 模式切换（带滑动指示器）
 * 切换模式时自动聚焦对应模式最近活跃的 Tab
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  appModeAtom,
  lastActiveChatTabIdAtom,
  lastActiveAgentTabIdAtom,
  type AppMode,
} from '@/atoms/app-mode'
import { tabsAtom, splitLayoutAtom, focusTab } from '@/atoms/tab-atoms'
import { cn } from '@/lib/utils'

const modes: { value: AppMode; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'agent', label: 'Agent' },
]

export function ModeSwitcher(): React.ReactElement {
  const [mode, setMode] = useAtom(appModeAtom)
  const tabs = useAtomValue(tabsAtom)
  const layout = useAtomValue(splitLayoutAtom)
  const setLayout = useSetAtom(splitLayoutAtom)
  const lastChatTab = useAtomValue(lastActiveChatTabIdAtom)
  const lastAgentTab = useAtomValue(lastActiveAgentTabIdAtom)

  const handleModeSwitch = (newMode: AppMode): void => {
    if (newMode === mode) return

    const targetTabId = newMode === 'chat' ? lastChatTab : lastAgentTab

    if (targetTabId) {
      const targetTab = tabs.find((t) => t.id === targetTabId)
      // 仅当 Tab 存在且类型匹配时聚焦
      if (targetTab && targetTab.type === newMode) {
        setLayout(focusTab(layout, targetTabId))
      }
    }

    // 切换模式
    setMode(newMode)
  }

  return (
    <div className="px-2 pt-2">
      <div className="relative flex rounded-lg bg-muted p-1">
        {/* 滑动背景指示器 */}
        <div
          className={cn(
            'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded bg-background shadow-sm transition-transform duration-300 ease-in-out',
            mode === 'chat' ? 'translate-x-0' : 'translate-x-full'
          )}
        />
        {modes.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleModeSwitch(value)}
            className={cn(
              'relative z-[1] flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200',
              mode === value
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
