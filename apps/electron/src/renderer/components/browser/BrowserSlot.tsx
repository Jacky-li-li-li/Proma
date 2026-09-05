import * as React from 'react'
import { useAtomValue } from 'jotai'
import { nextBrowserLayoutRevision } from './browser-layout-revision'
import { fullscreenModalCountAtom } from '@/atoms/modal-atoms'

// 每次 publish（包括卸载隐藏）分配全局单调 revision。旧 slot 的 IPC 即使晚到，
// 主进程也不会覆盖随后已挂载 tab 的可见性和边界。
// WebContentsView 是原生子视图，天然盖在 renderer DOM 之上；CSS z-index 无法反转。
//
// 可见性策略：
// - 常规情况只由 BrowserSlot 的尺寸和 Tab 生命周期控制，不为 Popover、Dropdown、
//   Toast 等局部浮层隐藏，避免频繁隐藏/恢复导致右侧浏览器白屏与闪烁。
// - 全屏模态（Dialog/AlertDialog 等带全屏遮罩的居中弹窗，如删除项目确认框）打开
//   时，弹窗与浏览器区域必然相交且会被原生视图压住。此时临时隐藏视图（保留
//   session），全部模态关闭后立即恢复。

export function BrowserSlot({ sessionId, tabId }: { sessionId: string; tabId: string }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null)
  const fullscreenModalCount = useAtomValue(fullscreenModalCountAtom)
  const modalBlockedRef = React.useRef(fullscreenModalCount > 0)
  const publishRef = React.useRef<(visible: boolean, preserveSessionOnHide?: boolean, immediate?: boolean) => void>(() => {})

  React.useLayoutEffect(() => {
    const element = ref.current
    const setLayout = (window.electronAPI as Partial<typeof window.electronAPI>).setAgentBrowserLayout
    if (!element || typeof setLayout !== 'function') return
    let frame = 0
    const commitLayout = (visible: boolean, preserveSessionOnHide: boolean) => {
      const rect = element.getBoundingClientRect()
      void setLayout({
        sessionId,
        tabId,
        revision: nextBrowserLayoutRevision(),
        visible: visible && rect.width > 4 && rect.height > 4,
        preserveSessionOnHide,
        bounds: {
          x: Math.round(rect.x), y: Math.round(rect.y),
          width: Math.round(rect.width), height: Math.round(rect.height),
        },
      })
    }
    const publish = (visible: boolean, preserveSessionOnHide = false, immediate = false) => {
      if (frame) cancelAnimationFrame(frame)
      if (immediate) {
        frame = 0
        commitLayout(visible, preserveSessionOnHide)
        return
      }
      frame = requestAnimationFrame(() => {
        frame = 0
        commitLayout(visible, preserveSessionOnHide)
      })
    }
    publishRef.current = publish
    const publishCurrentVisibility = (immediate = false) => publish(!modalBlockedRef.current, false, immediate)
    const observer = new ResizeObserver(() => publishCurrentVisibility())
    const publishBounded = () => publishCurrentVisibility()
    observer.observe(element)
    window.addEventListener('resize', publishBounded)
    // Tab 切换时先前 Slot 会立即发出 hide。新 Slot 不能再等一帧才 show，
    // 否则快速左右切换时原生视图会停留在隐藏状态，表现为页面内容消失。
    // 若挂载时已有全屏模态打开，则保持隐藏让位给弹窗。
    publishCurrentVisibility(true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', publishBounded)
      if (frame) cancelAnimationFrame(frame)
      publishRef.current = () => {}
      void setLayout({ sessionId, tabId, revision: nextBrowserLayoutRevision(), visible: false, preserveSessionOnHide: false, bounds: { x: 0, y: 0, width: 0, height: 0 } })
    }
  }, [sessionId, tabId])

  // 全屏模态出现/消失时立即让位或恢复原生视图。immediate 发布确保弹窗打开瞬间
  // 不被遮挡；恢复由计数器归零触发，且每次发布携带新的 revision，主进程不会因
  // 旧布局晚到而吞掉恢复信号。
  React.useEffect(() => {
    const blocked = fullscreenModalCount > 0
    if (blocked === modalBlockedRef.current) return
    modalBlockedRef.current = blocked
    publishRef.current(!blocked, blocked, true)
  }, [fullscreenModalCount])

  return <div ref={ref} className="flex-1 min-h-0 bg-muted/15 titlebar-no-drag" aria-label="受管浏览器页面" />
}
