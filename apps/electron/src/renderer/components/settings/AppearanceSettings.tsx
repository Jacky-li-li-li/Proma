/**
 * AppearanceSettings - 外观设置页
 *
 * 主题切换（浅色/深色/跟随系统），使用 SettingsSegmentedControl。
 * 消息卡片颜色自定义（用户消息 / AI 消息）。
 * 通过 Jotai atom 管理状态，持久化到 ~/.proma/settings.json。
 */

import * as React from 'react'
import { useAtom } from 'jotai'
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SettingsSegmentedControl,
  SettingsColorPicker,
} from './primitives'
import { themeModeAtom, updateThemeMode } from '@/atoms/theme'
import {
  messageBubbleColorsAtom,
  updateMessageBubbleColors,
  resetMessageBubbleColors,
} from '@/atoms/message-bubble-colors'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import type { ThemeMode } from '../../../types'

/** 主题选项 */
const THEME_OPTIONS = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

/** 根据平台返回缩放快捷键提示 */
const isMac = navigator.userAgent.includes('Mac')
const ZOOM_HINT = isMac
  ? '使用 ⌘+ 放大、⌘- 缩小、⌘0 恢复默认大小'
  : '使用 Ctrl++ 放大、Ctrl+- 缩小、Ctrl+0 恢复默认大小'

export function AppearanceSettings(): React.ReactElement {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom)
  const [messageColors, setMessageColors] = useAtom(messageBubbleColorsAtom)

  /** 切换主题模式 */
  const handleThemeChange = React.useCallback(
    (value: string) => {
      const mode = value as ThemeMode
      setThemeMode(mode)
      void updateThemeMode(mode)
    },
    [setThemeMode]
  )

  /** 更新用户消息颜色 */
  const handleUserColorChange = React.useCallback(
    (color: string) => {
      const updated = { ...messageColors, userMessageColor: color }
      setMessageColors(updated)
      void updateMessageBubbleColors({ userMessageColor: color })
    },
    [messageColors, setMessageColors]
  )

  /** 更新 AI 消息颜色 */
  const handleAssistantColorChange = React.useCallback(
    (color: string) => {
      const updated = { ...messageColors, assistantMessageColor: color }
      setMessageColors(updated)
      void updateMessageBubbleColors({ assistantMessageColor: color })
    },
    [messageColors, setMessageColors]
  )

  /** 重置所有颜色 */
  const handleResetAllColors = React.useCallback(() => {
    void resetMessageBubbleColors()
    setMessageColors({ userMessageColor: '', assistantMessageColor: '' })
  }, [setMessageColors])

  // 检查是否有自定义颜色
  const hasCustomColors =
    messageColors.userMessageColor || messageColors.assistantMessageColor

  return (
    <div className="space-y-6">
      {/* 主题设置 */}
      <SettingsSection
        title="外观设置"
        description="自定义应用的视觉风格"
      >
        <SettingsCard>
          <SettingsSegmentedControl
            label="主题模式"
            description="选择应用的配色方案"
            value={themeMode}
            onValueChange={handleThemeChange}
            options={THEME_OPTIONS}
          />
          <SettingsRow
            label="界面缩放"
            description={ZOOM_HINT}
          />
        </SettingsCard>
      </SettingsSection>

      {/* 消息气泡颜色设置 */}
      <SettingsSection
        title="消息气泡颜色"
        description="自定义聊天消息的气泡背景颜色"
        action={
          hasCustomColors ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAllColors}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              恢复默认
            </Button>
          ) : null
        }
      >
        <SettingsCard>
          <SettingsRow
            label="用户消息颜色"
            description="自己发送的消息气泡背景色"
          >
            <SettingsColorPicker
              value={messageColors.userMessageColor}
              onChange={handleUserColorChange}
            />
          </SettingsRow>
          <SettingsRow
            label="AI 消息颜色"
            description="AI 回复的消息气泡背景色"
          >
            <SettingsColorPicker
              value={messageColors.assistantMessageColor}
              onChange={handleAssistantColorChange}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
