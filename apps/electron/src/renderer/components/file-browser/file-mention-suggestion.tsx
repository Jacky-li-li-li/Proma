/**
 * FileMentionSuggestion — TipTap Mention Suggestion 配置
 *
 * 工厂函数，创建用于 @ 引用文件的 TipTap Suggestion 配置。
 * 
 * 设计原则：所有数据直接通过 IPC 获取，不依赖外部状态。
 * 输入 @ 后，递归扫描所有目录显示在 FileMentionList 中。
 */

import type React from 'react'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions } from '@tiptap/suggestion'
import { FileMentionList } from './FileMentionList'
import type { FileMentionRef } from './FileMentionList'
import type { FileIndexEntry, FileEntry } from '@proma/shared'
import { createMentionPopup, positionPopup } from '@/components/agent/mention-popup-utils'

/**
 * 从路径中提取文件夹名称
 */
function getFolderName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || path
}

/**
 * 递归扫描目录，限制深度
 */
async function scanDirectory(
  dirPath: string,
  folderName: string,
  queryLower: string,
  depth: number = 0,
  maxDepth: number = 3,
  listFn: (path: string) => Promise<FileEntry[]>
): Promise<FileIndexEntry[]> {
  if (depth > maxDepth) return []

  const items = await listFn(dirPath).catch(() => [])
  const result: FileIndexEntry[] = []

  for (const item of items) {
    // 过滤匹配查询
    if (queryLower && !item.name.toLowerCase().includes(queryLower)) {
      // 如果当前项不匹配，但如果是目录，仍可能子项匹配，继续递归
      if (!item.isDirectory) continue
    }

    result.push({
      name: item.name,
      path: item.path,
      type: (item.isDirectory ? 'dir' : 'file') as 'file' | 'dir',
      source: 'workspace' as const,
      folder: folderName,
      folderPath: dirPath,
      depth,
    })

    // 递归扫描子目录
    if (item.isDirectory) {
      const subItems = await scanDirectory(item.path, folderName, queryLower, depth + 1, maxDepth, listFn)
      result.push(...subItems)
    }
  }

  return result
}

/**
 * 创建文件 @ 引用的 Suggestion 配置
 * 
 * @param workspaceIdRef 当前工作区 ID
 * @param sessionIdRef 当前会话 ID
 * @param workspaceSlugRef 当前工作区 slug
 * @param mentionActiveRef 是否正在 mention 模式（用于阻止 Enter 发送消息）
 */
export function createFileMentionSuggestion(
  workspaceIdRef: React.RefObject<string | null>,
  sessionIdRef: React.RefObject<string | null>,
  workspaceSlugRef: React.RefObject<string | null>,
  mentionActiveRef: React.MutableRefObject<boolean>,
): Omit<SuggestionOptions<FileIndexEntry>, 'editor'> {
  return {
    char: '@',
    allowSpaces: false,

    // 异步搜索文件（本会话文件 + 工作区文件）
    items: async ({ query }): Promise<FileIndexEntry[]> => {
      const workspaceId = workspaceIdRef.current
      const sessionId = sessionIdRef.current
      const workspaceSlug = workspaceSlugRef.current
      const queryLower = (query ?? '').toLowerCase()

      // 如果没有工作区和会话信息，返回空
      if (!workspaceId || !sessionId) return []

      try {
        // 并行获取所有路径信息
        const [
          sessionPathResult,
          workspaceFilesPathResult,
          attachedDirsResult,
        ] = await Promise.all([
          window.electronAPI.getAgentSessionPath(workspaceId, sessionId).catch(() => null),
          workspaceSlug ? window.electronAPI.getWorkspaceFilesPath(workspaceSlug).catch(() => null) : Promise.resolve(null),
          workspaceSlug ? window.electronAPI.getWorkspaceDirectories(workspaceSlug).catch(() => []) : Promise.resolve([]),
        ])

        const allItems: FileIndexEntry[] = []

        // 1. 搜索本会话文件（递归，限制深度3）
        if (sessionPathResult) {
          const sessionFiles = await scanDirectory(
            sessionPathResult,
            '本会话文件',
            queryLower,
            0,
            3,
            (path) => window.electronAPI.listDirectory(path)
          )
          // 标记为 session source
          sessionFiles.forEach(item => { item.source = 'session'; item.folder = undefined })
          allItems.push(...sessionFiles)
        }

        // 2.1 搜索上传文件目录（递归，限制深度3）
        if (workspaceFilesPathResult) {
          const uploadFiles = await scanDirectory(
            workspaceFilesPathResult,
            '上传文件',
            queryLower,
            0,
            3,
            (path) => window.electronAPI.listDirectory(path)
          )
          allItems.push(...uploadFiles)
        }

        // 2.2 搜索关联的外部目录（递归，限制深度3）
        for (const dir of attachedDirsResult) {
          const folderName = getFolderName(dir)
          const attachedFiles = await scanDirectory(
            dir,
            folderName,
            queryLower,
            0,
            3,
            (path) => window.electronAPI.listAttachedDirectory(path)
          )
          allItems.push(...attachedFiles)
        }

        return allItems
      } catch (error) {
        console.error('[FileMention] 搜索文件失败:', error)
        return []
      }
    },

    // 渲染下拉列表
    render: () => {
      let renderer: ReactRenderer<FileMentionRef> | null = null
      let popup: HTMLDivElement | null = null

      return {
        onStart(props) {
          mentionActiveRef.current = true
          renderer = new ReactRenderer(FileMentionList, {
            props: {
              items: props.items,
              selectedIndex: 0,
              onSelect: (item: FileIndexEntry) => {
                props.command({ id: item.path, label: item.name })
              },
            },
            editor: props.editor,
          })

          popup = createMentionPopup(renderer.element)
          positionPopup(popup, props.clientRect?.())
        },

        onUpdate(props) {
          renderer?.updateProps({ items: props.items })
          positionPopup(popup, props.clientRect?.())
        },

        onKeyDown(props) {
          return renderer?.ref?.onKeyDown({ event: props.event }) ?? false
        },

        onExit() {
          mentionActiveRef.current = false
          popup?.remove()
          popup = null
          renderer?.destroy()
          renderer = null
        },
      }
    },
  }
}
