import * as React from 'react'
import { useSetAtom } from 'jotai'
import { fullscreenModalCountAtom } from '@/atoms/modal-atoms'

/**
 * 组件挂载期间登记一个全屏模态（带全屏遮罩的 Dialog/AlertDialog）。
 *
 * 受管浏览器原生 WebContentsView 盖在 renderer DOM 之上，模态打开时若与浏览器
 * 区域相交，弹窗会被遮挡且点击会落入网页。登记后 BrowserSlot 会临时隐藏原生
 * 视图（保留 session），全部模态关闭后再恢复。
 *
 * @param enabled 仅在 true 时登记。挂载到局部容器、不遮挡整个窗口的弹窗应传 false。
 */
export function useFullscreenModalRegistration(enabled = true): void {
  const setFullscreenModalCount = useSetAtom(fullscreenModalCountAtom)

  React.useEffect(() => {
    if (!enabled) return
    setFullscreenModalCount((count) => count + 1)
    return () => setFullscreenModalCount((count) => Math.max(0, count - 1))
  }, [enabled, setFullscreenModalCount])
}
