/**
 * 消息气泡颜色状态管理
 *
 * 管理用户和 AI 消息气泡的自定义背景颜色。
 * 使用 CSS 变量实现即时预览，持久化到 ~/.proma/settings.json
 */

import { atom } from 'jotai'
import { DEFAULT_MESSAGE_BUBBLE_COLORS } from '../../types'
import type { MessageBubbleColors } from '../../types'

/** 消息气泡颜色状态 */
export const messageBubbleColorsAtom = atom<MessageBubbleColors>(DEFAULT_MESSAGE_BUBBLE_COLORS)

/** CSS 变量名常量 */
const CSS_VAR_USER_MESSAGE = '--user-message-bg'
const CSS_VAR_ASSISTANT_MESSAGE = '--assistant-message-bg'

/**
 * 应用颜色配置到 DOM CSS 变量
 * 注意：当颜色为空字符串时，移除 CSS 变量以让 CSS 使用回退值
 */
function applyColorsToDOM(colors: MessageBubbleColors): void {
  const root = document.documentElement
  
  if (colors.userMessageColor) {
    root.style.setProperty(CSS_VAR_USER_MESSAGE, colors.userMessageColor)
  } else {
    root.style.removeProperty(CSS_VAR_USER_MESSAGE)
  }
  
  if (colors.assistantMessageColor) {
    root.style.setProperty(CSS_VAR_ASSISTANT_MESSAGE, colors.assistantMessageColor)
  } else {
    root.style.removeProperty(CSS_VAR_ASSISTANT_MESSAGE)
  }
}

/**
 * 初始化消息气泡颜色
 * 从主进程加载设置并应用到 DOM
 */
export async function initializeMessageBubbleColors(
  setColors: (colors: MessageBubbleColors) => void,
): Promise<void> {
  const settings = await window.electronAPI.getSettings()
  const colors = settings.messageBubbleColors ?? DEFAULT_MESSAGE_BUBBLE_COLORS
  setColors(colors)
  applyColorsToDOM(colors)
}

/**
 * 更新消息气泡颜色
 * 更新设置、持久化到文件，并应用到 DOM
 */
export async function updateMessageBubbleColors(
  updates: Partial<MessageBubbleColors>,
): Promise<void> {
  const settings = await window.electronAPI.getSettings()
  const updated: MessageBubbleColors = {
    userMessageColor: settings.messageBubbleColors?.userMessageColor ?? '',
    assistantMessageColor: settings.messageBubbleColors?.assistantMessageColor ?? '',
    ...updates,
  }
  await window.electronAPI.updateSettings({ messageBubbleColors: updated })
  applyColorsToDOM(updated)
}

/**
 * 重置消息气泡颜色为默认值
 */
export async function resetMessageBubbleColors(): Promise<void> {
  await window.electronAPI.updateSettings({ messageBubbleColors: DEFAULT_MESSAGE_BUBBLE_COLORS })
  applyColorsToDOM(DEFAULT_MESSAGE_BUBBLE_COLORS)
}
