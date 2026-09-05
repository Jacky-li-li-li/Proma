import { atom } from 'jotai'

/**
 * 当前打开的全屏模态（Dialog / AlertDialog 等带全屏遮罩的浮层）数量。
 *
 * 受管浏览器是 Electron 原生 WebContentsView，天然盖在 renderer DOM 之上且无法被
 * CSS z-index 反转。BrowserSlot 订阅此计数：计数 > 0 时临时隐藏原生视图（保留
 * session），全部模态关闭后再恢复，避免居中弹窗（如删除项目确认框）的按钮被
 * 右侧浏览器遮挡而无法点击。
 */
export const fullscreenModalCountAtom = atom(0)
