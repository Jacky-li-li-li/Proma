/**
 * FileMentionList — @ 引用文件下拉列表
 *
 * 显示文件搜索结果，按"本会话文件"和"工作区文件"分组，
 * 工作区文件进一步按文件夹（上传文件、voc、generated等）分组。
 * 支持键盘导航（上/下/Enter/Escape）。
 * 通过 React.useImperativeHandle 暴露 onKeyDown 给 TipTap Suggestion。
 */

import * as React from 'react'
import { Folder, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileIndexEntry } from '@proma/shared'

export interface FileMentionListProps {
  items: FileIndexEntry[]
  selectedIndex: number
  onSelect: (item: FileIndexEntry) => void
}

export interface FileMentionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

// 文件夹分组
interface FolderGroup {
  name: string
  path: string
  items: FileIndexEntry[]
}

// 一级分组（本会话/工作区）
interface SourceGroup {
  source: 'session' | 'workspace'
  name: string
  // 本会话文件的直接子项
  items: FileIndexEntry[]
  // 工作区文件的文件夹分组
  folders: FolderGroup[]
}

export const FileMentionList = React.forwardRef<FileMentionRef, FileMentionListProps>(
  function FileMentionList({ items, selectedIndex, onSelect }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null)

    // 构建分组数据结构
    const groupedData = React.useMemo(() => {
      // 按 source 分组
      const sessionItems = items.filter((item) => item.source === 'session')
      const workspaceItems = items.filter((item) => item.source === 'workspace')

      // 工作区文件按 folder 分组
      const folderMap = new Map<string, FolderGroup>()
      workspaceItems.forEach((item) => {
        const folderName = item.folder || '其他'
        const folderPath = item.folderPath || ''
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, { name: folderName, path: folderPath, items: [] })
        }
        folderMap.get(folderName)!.items.push(item)
      })

      const result: SourceGroup[] = []
      if (sessionItems.length > 0) {
        result.push({
          source: 'session',
          name: '本会话文件',
          items: sessionItems,
          folders: [],
        })
      }

      if (workspaceItems.length > 0) {
        result.push({
          source: 'workspace',
          name: '工作区文件',
          items: [],
          folders: Array.from(folderMap.values()),
        })
      }

      return result
    }, [items])

    // 构建扁平化列表用于键盘导航（按显示顺序）
    const flatItems = React.useMemo(() => {
      const flat: FileIndexEntry[] = []
      groupedData.forEach((group) => {
        if (group.source === 'session') {
          flat.push(...group.items)
        } else {
          group.folders.forEach((folder) => {
            flat.push(...folder.items)
          })
        }
      })
      return flat
    }, [groupedData])

    // 滚动选中项到可见区域
    React.useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const buttons = container.querySelectorAll('button[data-item-index]')
      const item = buttons[selectedIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    // 暴露键盘处理给 TipTap
    React.useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          const newIndex = selectedIndex <= 0 ? flatItems.length - 1 : selectedIndex - 1
          const item = flatItems[newIndex]
          if (item) onSelect(item)
          return true
        }
        if (event.key === 'ArrowDown') {
          const newIndex = selectedIndex >= flatItems.length - 1 ? 0 : selectedIndex + 1
          const item = flatItems[newIndex]
          if (item) onSelect(item)
          return true
        }
        if (event.key === 'Enter') {
          const item = flatItems[selectedIndex]
          if (item) onSelect(item)
          return true
        }
        if (event.key === 'Escape') {
          return true
        }
        return false
      },
    }))

    // 无匹配结果
    if (items.length === 0) {
      return (
        <div className="rounded-lg border bg-popover p-2 shadow-lg text-[11px] text-muted-foreground">
          无匹配文件
        </div>
      )
    }

    // 渲染文件项，根据 depth 缩进
    const renderFileItem = (item: FileIndexEntry, globalIndex: number) => {
      // 基础缩进 12px，每层 depth 增加 12px
      const depth = item.depth ?? 0
      const paddingLeft = 12 + depth * 12  // 基础 12px + 层级缩进
      
      return (
        <button
          key={`${item.source}-${item.path}`}
          type="button"
          data-item-index={globalIndex}
          className={cn(
            'w-full flex items-center gap-1.5 py-1 pr-2.5 text-left text-xs hover:bg-accent transition-colors',
            globalIndex === selectedIndex && 'bg-accent text-accent-foreground'
          )}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onSelect(item)}
        >
          {item.type === 'dir' ? (
            <Folder className="size-3 flex-shrink-0 text-amber-500" />
          ) : (
            <FileText className="size-3 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="truncate flex-1">{item.name}</span>
        </button>
      )
    }

    // 计算全局索引
    let currentIndex = 0
    const getNextIndex = () => currentIndex++

    return (
      <div
        ref={containerRef}
        className="rounded-lg border bg-popover shadow-lg overflow-y-auto max-h-[360px] min-w-[280px]"
      >
        {groupedData.map((group, groupIndex) => (
          <div key={group.source} className={cn('py-1', groupIndex > 0 && 'border-t border-border/50')}
          >
            {/* 一级分组标题：本会话文件 / 工作区文件 */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium sticky top-0 bg-popover z-10',
                group.source === 'session' ? 'text-muted-foreground/80' : 'text-primary/80'
              )}
            >
              <Folder className={cn(
                'size-3',
                group.source === 'session' ? 'text-muted-foreground/60' : 'text-primary/60'
              )} />
              <span>{group.name}</span>
              <span className={cn(
                'text-[10px]',
                group.source === 'session' ? 'text-muted-foreground/50' : 'text-primary/50'
              )}>
                ({group.source === 'session' ? group.items.length : group.folders.reduce((sum, f) => sum + f.items.length, 0)})
              </span>
            </div>

            {/* 本会话文件：直接显示 */}
            {group.source === 'session' && (
              <div>
                {group.items.map((item) => renderFileItem(item, getNextIndex()))}
              </div>
            )}

            {/* 工作区文件：按文件夹分组显示 */}
            {group.source === 'workspace' && (
              <div className="pl-2">
                {group.folders.map((folder) => (
                  <div key={folder.name} className="mb-1">
                    {/* 文件夹标题 */}
                    <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-muted-foreground/70">
                      <ChevronRight className="size-3 text-muted-foreground/40" />
                      <Folder className="size-3 text-amber-500/70" />
                      <span className="font-medium">{folder.name}</span>
                      <span className="text-[10px] text-muted-foreground/40">({folder.items.length})</span>
                    </div>
                    {/* 文件夹内文件 */}
                    <div>
                      {folder.items.map((item) => renderFileItem(item, getNextIndex()))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  },
)
