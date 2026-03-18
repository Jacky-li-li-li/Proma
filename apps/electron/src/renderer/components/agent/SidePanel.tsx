/**
 * SidePanel — Agent 侧面板容器
 *
 * 包含 Team Activity 和 File Browser 两个 Tab。
 * 面板可自动打开（检测到 Team/Task 活动或文件变化）
 * 或由用户手动切换。
 *
 * 切换按钮在面板关闭时显示活动指示点。
 */

import * as React from 'react'
import { toast } from 'sonner'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { PanelRight, X, Users, FolderOpen, ExternalLink, RefreshCw, ChevronRight, ChevronDown, Folder, FileText, MoreHorizontal, FolderSearch, Pencil, FolderInput, Info, FolderPlus, Trash2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { FileBrowser, FileDropZone } from '@/components/file-browser'
import { TeamActivityPanel } from './TeamActivityPanel'
import {
  agentSidePanelOpenMapAtom,
  agentSidePanelTabMapAtom,
  agentStreamingStatesAtom,
  cachedTeamActivitiesAtom,
  buildTeamActivityEntries,
  workspaceFilesVersionAtom,
  currentAgentWorkspaceIdAtom,
  agentWorkspacesAtom,
  workspaceAttachedDirectoriesMapAtom,
} from '@/atoms/agent-atoms'
import type { SidePanelTab } from '@/atoms/agent-atoms'
import type { FileEntry } from '@proma/shared'

interface SidePanelProps {
  sessionId: string
  sessionPath: string | null
}

export function SidePanel({ sessionId, sessionPath }: SidePanelProps): React.ReactElement {
  // per-session 侧面板状态
  const sidePanelOpenMap = useAtomValue(agentSidePanelOpenMapAtom)
  const setSidePanelOpenMap = useSetAtom(agentSidePanelOpenMapAtom)
  const sidePanelTabMap = useAtomValue(agentSidePanelTabMapAtom)
  const setSidePanelTabMap = useSetAtom(agentSidePanelTabMapAtom)

  const isOpen = sidePanelOpenMap.get(sessionId) ?? false
  const activeTab = sidePanelTabMap.get(sessionId) ?? 'team'

  const setIsOpen = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setSidePanelOpenMap((prev) => {
      const map = new Map(prev)
      const current = map.get(sessionId) ?? false
      map.set(sessionId, typeof value === 'function' ? value(current) : value)
      return map
    })
  }, [sessionId, setSidePanelOpenMap])

  const setActiveTab = React.useCallback((tab: SidePanelTab) => {
    setSidePanelTabMap((prev) => {
      const map = new Map(prev)
      map.set(sessionId, tab)
      return map
    })
  }, [sessionId, setSidePanelTabMap])

  // 直接用 sessionId 计算 team 活动（不依赖 currentAgentSessionIdAtom）
  const streamingStates = useAtomValue(agentStreamingStatesAtom)
  const cachedActivities = useAtomValue(cachedTeamActivitiesAtom)

  const hasTeamActivity = React.useMemo(() => {
    const state = streamingStates.get(sessionId)
    if (state) {
      return state.toolActivities.some(
        (a) => a.toolName === 'Task' || a.toolName === 'Agent'
      )
    }
    const cached = cachedActivities.get(sessionId)
    return cached !== undefined && cached.length > 0
  }, [sessionId, streamingStates, cachedActivities])

  const runningCount = React.useMemo(() => {
    const state = streamingStates.get(sessionId)
    if (state && state.toolActivities.length > 0) {
      const entries = buildTeamActivityEntries(state.toolActivities)
      return entries.filter((e) => e.status === 'running' || e.status === 'backgrounded').length
    }
    const cached = cachedActivities.get(sessionId)
    if (cached) {
      return cached.filter((e) => e.status === 'running' || e.status === 'backgrounded').length
    }
    return 0
  }, [sessionId, streamingStates, cachedActivities])

  const filesVersion = useAtomValue(workspaceFilesVersionAtom)
  const setFilesVersion = useSetAtom(workspaceFilesVersionAtom)
  const hasFileChanges = filesVersion > 0

  // 工作区文件上传后，刷新文件列表
  const handleWorkspaceFilesUploaded = React.useCallback(() => {
    setFilesVersion((prev) => prev + 1)
  }, [setFilesVersion])

  // 派生当前工作区 slug（用于 FileDropZone IPC 调用）
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspaceSlug = workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null

  // 工作区文件列表（关联的外部文件夹）
  const wsAttachedDirsMap = useAtomValue(workspaceAttachedDirectoriesMapAtom)
  const setWsAttachedDirsMap = useSetAtom(workspaceAttachedDirectoriesMapAtom)

  // 文件夹关联成功后更新状态
  const handleFoldersAttached = React.useCallback((updatedDirs: string[]) => {
    if (!currentWorkspaceId) return
    setWsAttachedDirsMap((prev) => {
      const map = new Map(prev)
      map.set(currentWorkspaceId, updatedDirs)
      return map
    })
  }, [currentWorkspaceId, setWsAttachedDirsMap])
  const wsAttachedDirs = currentWorkspaceId ? (wsAttachedDirsMap.get(currentWorkspaceId) ?? []) : []

  // 工作区文件目录路径（用于显示上传的文件）
  const [workspaceFilesPath, setWorkspaceFilesPath] = React.useState<string | null>(null)

  // 加载工作区文件列表（关联的外部文件夹 + workspace-files 目录）
  React.useEffect(() => {
    if (!workspaceSlug || !currentWorkspaceId) return
    
    // 获取关联的目录和 workspace-files 路径
    Promise.all([
      window.electronAPI.getWorkspaceDirectories(workspaceSlug),
      window.electronAPI.getWorkspaceFilesPath(workspaceSlug),
    ]).then(([dirs, filesPath]) => {
      setWsAttachedDirsMap((prev) => {
        const map = new Map(prev)
        map.set(currentWorkspaceId, dirs)
        return map
      })
      setWorkspaceFilesPath(filesPath)
    }).catch(console.error)
  }, [workspaceSlug, currentWorkspaceId, setWsAttachedDirsMap])

  // 关联工作区文件或文件夹（外部文件/文件夹）
  const handleAttachWorkspaceFilesOrFolders = React.useCallback(async () => {
    if (!workspaceSlug || !currentWorkspaceId) return
    try {
      const result = await window.electronAPI.openFileOrFolderDialog()
      if (!result) return

      // 处理文件夹关联
      if (result.folders.length > 0) {
        let updated = wsAttachedDirsMap.get(currentWorkspaceId) ?? []
        for (const folder of result.folders) {
          updated = await window.electronAPI.attachWorkspaceDirectory({
            workspaceSlug,
            directoryPath: folder.path,
          })
        }
        setWsAttachedDirsMap((prev) => {
          const map = new Map(prev)
          map.set(currentWorkspaceId, updated)
          return map
        })
      }

      // 处理文件上传
      if (result.files.length > 0) {
        await window.electronAPI.saveFilesToWorkspaceFiles({
          workspaceSlug,
          files: result.files,
        })
        // 刷新文件列表
        setFilesVersion((prev) => prev + 1)
      }

      // 显示提示
      const folderCount = result.folders.length
      const fileCount = result.files.length
      if (folderCount > 0 && fileCount > 0) {
        toast.success(`已关联 ${folderCount} 个文件夹，上传 ${fileCount} 个文件`)
      } else if (folderCount > 0) {
        toast.success(`已关联 ${folderCount} 个文件夹`)
      } else if (fileCount > 0) {
        toast.success(`已上传 ${fileCount} 个文件`)
      }
    } catch (error) {
      console.error('[SidePanel] 关联失败:', error)
      toast.error('关联失败')
    }
  }, [workspaceSlug, currentWorkspaceId, wsAttachedDirsMap, setWsAttachedDirsMap, setFilesVersion])

  const handleDetachWorkspaceDirectory = React.useCallback(async (dirPath: string) => {
    if (!workspaceSlug || !currentWorkspaceId) return
    try {
      const updated = await window.electronAPI.detachWorkspaceDirectory({
        workspaceSlug,
        directoryPath: dirPath,
      })
      setWsAttachedDirsMap((prev) => {
        const map = new Map(prev)
        if (updated.length > 0) {
          map.set(currentWorkspaceId, updated)
        } else {
          map.delete(currentWorkspaceId)
        }
        return map
      })
    } catch (error) {
      console.error('[SidePanel] 移除工作区文件夹失败:', error)
    }
  }, [workspaceSlug, currentWorkspaceId, setWsAttachedDirsMap])

  // 文件上传完成后递增版本号，触发 FileBrowser 刷新
  const handleFilesUploaded = React.useCallback(() => {
    setFilesVersion((prev) => prev + 1)
  }, [setFilesVersion])

  // 手动刷新文件列表
  const handleRefresh = React.useCallback(() => {
    setFilesVersion((prev) => prev + 1)
  }, [setFilesVersion])

  // ===== 文件模块展开/折叠状态和高度计算 =====
  const [sessionFilesExpanded, setSessionFilesExpanded] = React.useState(true)
  const [workspaceFilesExpanded, setWorkspaceFilesExpanded] = React.useState(true)
  const [sessionFilesCount, setSessionFilesCount] = React.useState(0)

  // 监听本会话文件数量变化
  React.useEffect(() => {
    if (!sessionPath) {
      setSessionFilesCount(0)
      return
    }
    window.electronAPI.listDirectory(sessionPath)
      .then(items => setSessionFilesCount(items.length))
      .catch(() => setSessionFilesCount(0))
  }, [sessionPath, filesVersion])

  // 计算本会话文件区域高度（自适应，最大50%）
  const sessionSectionStyle = React.useMemo(() => {
    if (!sessionFilesExpanded) {
      return { height: '32px' } // 仅标题栏高度
    }
    
    const headerHeight = 32 // 标题栏高度
    const itemHeight = 28   // 每个文件项高度
    const maxHeightPercent = 50 // 最大占50%
    
    if (sessionFilesCount === 0) {
      return { height: `${headerHeight}px` }
    }
    
    // 计算内容高度（最多显示5个文件项的高度）
    const maxVisibleItems = 5
    const visibleItems = Math.min(sessionFilesCount, maxVisibleItems)
    const contentHeight = visibleItems * itemHeight
    const totalHeight = headerHeight + contentHeight
    
    // 计算百分比高度（基于面板高度约640px）
    const containerHeight = 640
    const calculatedPercent = (totalHeight / containerHeight) * 100
    
    return { 
      height: `${Math.min(calculatedPercent, maxHeightPercent)}%`,
      minHeight: `${headerHeight + itemHeight}px` // 至少显示一个文件项
    }
  }, [sessionFilesCount, sessionFilesExpanded])

  // 自动打开：文件变化时（仅在有 sessionPath 时）
  const prevFilesVersionRef = React.useRef(filesVersion)
  React.useEffect(() => {
    if (filesVersion > prevFilesVersionRef.current && sessionPath) {
      setIsOpen(true)
      // 仅在当前无 team 活动时切换到文件 tab
      if (!hasTeamActivity) {
        setActiveTab('files')
      }
    }
    prevFilesVersionRef.current = filesVersion
  }, [filesVersion, sessionPath, hasTeamActivity, setIsOpen, setActiveTab])

  // 面板是否可显示内容（需要有 sessionPath 或 team 活动）
  const hasContent = sessionPath || hasTeamActivity

  return (
    <div
      className={cn(
        'relative flex-shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden titlebar-drag-region',
        hasContent && isOpen ? 'w-[320px] border-l' : 'w-10',
      )}
    >
      {/* 切换按钮 — 始终固定在右上角 */}
      {hasContent && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2.5 top-2.5 z-10 h-7 w-7 titlebar-no-drag"
              onClick={() => setIsOpen((prev) => !prev)}
            >
              <PanelRight
                className={cn(
                  'size-3.5 absolute transition-all duration-200',
                  isOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100',
                )}
              />
              <X
                className={cn(
                  'size-3.5 absolute transition-all duration-200',
                  isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75',
                )}
              />
              {/* 活动指示点（面板关闭时显示） */}
              {!isOpen && (hasTeamActivity || hasFileChanges) && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{isOpen ? '关闭侧面板' : '打开侧面板'}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* 面板内容 */}
      {hasContent && (
        <div
          className={cn(
            'w-[320px] h-full flex flex-col transition-opacity duration-300 titlebar-no-drag',
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as SidePanelTab)}
            className="flex flex-col h-full"
          >
            {/* Tab 切换栏 */}
            <div className="flex items-center gap-1 px-2 pr-10 h-[48px] border-b flex-shrink-0">
              <TabsList className="h-8 bg-muted/50">
                <TabsTrigger value="team" className="text-xs h-7 px-3 gap-1.5">
                  <Users className="size-3" />
                  Team
                  {runningCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-primary text-primary-foreground leading-none">
                      {runningCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="files" className="text-xs h-7 px-3 gap-1.5">
                  <FolderOpen className="size-3" />
                  文件
                  {hasFileChanges && (
                    <span className="ml-0.5 size-1.5 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Team Activity Tab */}
            <TabsContent value="team" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <TeamActivityPanel sessionId={sessionId} />
            </TabsContent>

            {/* File Browser Tab */}
            <TabsContent value="files" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
              {sessionPath && workspaceSlug ? (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* ===== 本会话文件区（上方，自适应高度，最大50%） ===== */}
                  <div 
                    className="flex flex-col min-h-0 border-b border-dashed border-muted-foreground/20 transition-all duration-300 ease-in-out"
                    style={sessionSectionStyle}
                  >
                    {/* 标题栏 - 可点击展开/折叠 */}
                    <div 
                      className="flex items-center gap-1 px-3 h-[32px] flex-shrink-0 cursor-pointer hover:bg-accent/30 rounded-sm transition-colors"
                      onClick={() => setSessionFilesExpanded(v => !v)}
                    >
                      {sessionFilesExpanded ? (
                        <ChevronDown className="size-3 text-muted-foreground/70" />
                      ) : (
                        <ChevronRight className="size-3 text-muted-foreground/70" />
                      )}
                      <FolderOpen className="size-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">本会话文件</span>
                      {sessionFilesCount > 0 && (
                        <span className="text-[10px] text-muted-foreground/50 ml-1">({sessionFilesCount})</span>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3 text-muted-foreground/50 cursor-help ml-1" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <p>当前会话的专属文件，仅本次对话的 Agent 可以访问，新对话不继承</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="flex-1" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); window.electronAPI.openFile(sessionPath).catch(console.error) }}
                          >
                            <ExternalLink className="size-2.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>在 Finder 中打开</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleRefresh() }}
                          >
                            <RefreshCw className="size-2.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>刷新文件列表</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {/* 本会话文件浏览器（可滚动）- 仅查看对话中上传的附件 */}
                    <Collapsible open={sessionFilesExpanded} className="flex-1 min-h-0">
                      <CollapsibleContent className="h-full overflow-y-auto data-[state=closed]:hidden">
                        <FileBrowser rootPath={sessionPath} hideToolbar embedded />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* ===== 工作区文件区（下方，占据剩余空间） ===== */}
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* 标题栏 - 可点击展开/折叠 */}
                    <div 
                      className="flex items-center gap-1 px-3 h-[32px] flex-shrink-0 cursor-pointer hover:bg-accent/30 rounded-sm transition-colors"
                      onClick={() => setWorkspaceFilesExpanded(v => !v)}
                    >
                      {workspaceFilesExpanded ? (
                        <ChevronDown className="size-3 text-primary/70" />
                      ) : (
                        <ChevronRight className="size-3 text-primary/70" />
                      )}
                      <FolderOpen className="size-3 text-primary/70" />
                      <span className="text-[11px] font-medium text-primary/70">工作区文件</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3 text-primary/40 cursor-help ml-1" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px]">
                          <p>关联的外部文件夹，工作区内所有会话可访问，Agent 可直接修改原位置的文件</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="flex-1" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0 text-primary/70 hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); handleAttachWorkspaceFilesOrFolders() }}
                          >
                            <FolderPlus className="size-2.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>关联文件或文件夹</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {/* 工作区文件列表（可滚动） - 支持拖拽 */}
                    <Collapsible open={workspaceFilesExpanded} className="flex-1 min-h-0">
                      <CollapsibleContent className="h-full overflow-y-auto data-[state=closed]:hidden relative">
                        <FileDropZone
                          workspaceSlug={workspaceSlug ?? ''}
                          target="workspace"
                          onFilesUploaded={handleWorkspaceFilesUploaded}
                          onFoldersAttached={handleFoldersAttached}
                          className="h-full"
                          hideUI={wsAttachedDirs.length > 0 || !!workspaceFilesPath}
                        >
                          {(wsAttachedDirs.length > 0 || workspaceFilesPath) ? (
                            <WorkspaceFilesSection
                              attachedDirs={wsAttachedDirs}
                              onDetach={handleDetachWorkspaceDirectory}
                              refreshVersion={filesVersion}
                              workspaceFilesPath={workspaceFilesPath}
                            />
                          ) : null}
                        </FileDropZone>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  请选择工作区
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

// ===== 工作区文件容器（关联的外部文件夹） =====

interface WorkspaceFilesSectionProps {
  attachedDirs: string[]
  onDetach: (dirPath: string) => void
  /** 文件版本号，用于自动刷新已展开的目录 */
  refreshVersion: number
  /** workspace-files 目录路径（用于显示上传的文件） */
  workspaceFilesPath: string | null
}

/** 工作区文件区域：统一管理所有关联的外部文件夹和上传的文件 */
function WorkspaceFilesSection({ attachedDirs, onDetach, refreshVersion, workspaceFilesPath }: WorkspaceFilesSectionProps): React.ReactElement {
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set())
  // 最后选中的路径（用于 Shift 范围选择的锚点）
  const lastSelectedPathRef = React.useRef<string | null>(null)
  // 所有可见文件路径（用于 Shift 范围选择）
  const allVisiblePathsRef = React.useRef<Set<string>>(new Set())

  // 注册/注销可见路径
  const registerVisiblePath = React.useCallback((path: string) => {
    allVisiblePathsRef.current.add(path)
  }, [])
  const unregisterVisiblePath = React.useCallback((path: string) => {
    allVisiblePathsRef.current.delete(path)
  }, [])

  const handleSelect = React.useCallback((path: string, ctrlKey: boolean, shiftKey: boolean) => {
    setSelectedPaths((prev) => {
      if (shiftKey && lastSelectedPathRef.current && allVisiblePathsRef.current.size > 0) {
        // Shift+点击：范围选择
        const allPaths = Array.from(allVisiblePathsRef.current)
        const anchorIndex = allPaths.indexOf(lastSelectedPathRef.current)
        const targetIndex = allPaths.indexOf(path)
        if (anchorIndex !== -1 && targetIndex !== -1) {
          const start = Math.min(anchorIndex, targetIndex)
          const end = Math.max(anchorIndex, targetIndex)
          const rangePaths = allPaths.slice(start, end + 1)
          // 保持之前选中的，添加范围内的
          return new Set([...prev, ...rangePaths])
        }
      }
      
      if (ctrlKey) {
        // Ctrl+点击：切换选中
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
          if (lastSelectedPathRef.current === path) {
            lastSelectedPathRef.current = null
          }
        } else {
          next.add(path)
          lastSelectedPathRef.current = path
        }
        return next
      }
      
      // 普通点击：单选
      lastSelectedPathRef.current = path
      return new Set([path])
    })
  }, [])

  return (
    <div className="pt-1 pb-1 flex-shrink-0">
      {/* workspace-files 目录（显示上传的文件） */}
      {workspaceFilesPath && (
        <WorkspaceDirTree
          key="__workspace_files__"
          dirPath={workspaceFilesPath}
          onDetach={() => {}} // 不可分离
          selectedPaths={selectedPaths}
          onSelect={handleSelect}
          refreshVersion={refreshVersion}
          isSystemDir
          registerVisiblePath={registerVisiblePath}
          unregisterVisiblePath={unregisterVisiblePath}
        />
      )}
      {attachedDirs.map((dir) => (
        <WorkspaceDirTree
          key={dir}
          dirPath={dir}
          onDetach={() => onDetach(dir)}
          selectedPaths={selectedPaths}
          onSelect={handleSelect}
          refreshVersion={refreshVersion}
          registerVisiblePath={registerVisiblePath}
          unregisterVisiblePath={unregisterVisiblePath}
        />
      ))}
    </div>
  )
}

// ===== 工作区目录树组件 =====

interface WorkspaceDirTreeProps {
  dirPath: string
  onDetach: () => void
  selectedPaths: Set<string>
  onSelect: (path: string, ctrlKey: boolean, shiftKey: boolean) => void
  /** 文件版本号，变化时已展开的目录自动重新加载 */
  refreshVersion: number
  /** 是否为系统目录（workspace-files/），不可分离，显示特殊名称 */
  isSystemDir?: boolean
  /** 注册可见路径（用于 Shift 范围选择） */
  registerVisiblePath?: (path: string) => void
  /** 注销可见路径 */
  unregisterVisiblePath?: (path: string) => void
}

/** 工作区目录根节点：可展开/收起，带移除按钮 */
function WorkspaceDirTree({ dirPath, onDetach, selectedPaths, onSelect, refreshVersion, isSystemDir, registerVisiblePath, unregisterVisiblePath }: WorkspaceDirTreeProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<FileEntry[]>([])
  const [loaded, setLoaded] = React.useState(false)

  const dirName = isSystemDir ? '上传文件' : (dirPath.split('/').filter(Boolean).pop() || dirPath)

  // 当 refreshVersion 变化时，已展开的目录自动重新加载
  React.useEffect(() => {
    if (expanded && loaded) {
      window.electronAPI.listAttachedDirectory(dirPath)
        .then((items) => setChildren(items))
        .catch((err) => console.error('[WorkspaceDirTree] 刷新失败:', err))
    }
  }, [refreshVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (): Promise<void> => {
    if (!expanded && !loaded) {
      try {
        const items = await window.electronAPI.listAttachedDirectory(dirPath)
        setChildren(items)
        setLoaded(true)
      } catch (err) {
        console.error('[WorkspaceDirTree] 加载失败:', err)
      }
    }
    setExpanded(!expanded)
  }

  // 处理根节点点击（支持 Shift 范围选择）
  const handleClick = (e: React.MouseEvent) => {
    // Shift 多选时阻止默认文本选择行为
    if (e.shiftKey) {
      e.preventDefault()
    }
    onSelect(dirPath, e.ctrlKey || e.metaKey, e.shiftKey)
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-accent/50 group"
        onClick={toggleExpand}
      >
        <ChevronRight
          className={cn(
            'size-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150',
            expanded && 'rotate-90',
          )}
        />
        {expanded ? (
          <FolderOpen className="size-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="size-4 text-amber-500 flex-shrink-0" />
        )}
        <span className="text-xs truncate flex-1" title={dirPath}>
          {dirName}
        </span>
        {!isSystemDir && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onDetach() }}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
      {expanded && children.length === 0 && loaded && (
        <div className="text-[11px] text-muted-foreground/50 py-1" style={{ paddingLeft: 48 }}>
          空文件夹
        </div>
      )}
      {expanded && children.map((child) => (
        <WorkspaceDirItem 
          key={child.path} 
          entry={child} 
          depth={1} 
          selectedPaths={selectedPaths} 
          onSelect={onSelect} 
          refreshVersion={refreshVersion}
          registerVisiblePath={registerVisiblePath}
          unregisterVisiblePath={unregisterVisiblePath}
        />
      ))}
    </div>
  )
}

interface WorkspaceDirItemProps {
  entry: FileEntry
  depth: number
  selectedPaths: Set<string>
  onSelect: (path: string, ctrlKey: boolean, shiftKey: boolean) => void
  /** 文件版本号，变化时已展开的目录自动重新加载 */
  refreshVersion: number
  /** 注册可见路径（用于 Shift 范围选择） */
  registerVisiblePath?: (path: string) => void
  /** 注销可见路径 */
  unregisterVisiblePath?: (path: string) => void
}

/** 工作区目录子项：递归可展开，支持选中 + 三点菜单（含重命名、移动） */
function WorkspaceDirItem({ entry, depth, selectedPaths, onSelect, refreshVersion, registerVisiblePath, unregisterVisiblePath }: WorkspaceDirItemProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<FileEntry[]>([])
  const [loaded, setLoaded] = React.useState(false)
  // 重命名状态
  const [isRenaming, setIsRenaming] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState(entry.name)
  const renameInputRef = React.useRef<HTMLInputElement>(null)
  // 当前显示的名称和路径（重命名后更新）
  const [currentName, setCurrentName] = React.useState(entry.name)
  const [currentPath, setCurrentPath] = React.useState(entry.path)
  // 删除确认状态
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  const isSelected = selectedPaths.has(currentPath)

  // 注册/注销可见路径（用于 Shift 范围选择）
  React.useEffect(() => {
    registerVisiblePath?.(currentPath)
    return () => {
      unregisterVisiblePath?.(currentPath)
    }
  }, [currentPath])

  // 当 refreshVersion 变化时，已展开的文件夹自动重新加载子项
  React.useEffect(() => {
    if (expanded && loaded && entry.isDirectory) {
      window.electronAPI.listAttachedDirectory(currentPath)
        .then((items) => setChildren(items))
        .catch((err) => console.error('[WorkspaceDirItem] 刷新子目录失败:', err))
    }
  }, [refreshVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDir = async (): Promise<void> => {
    if (!entry.isDirectory) return
    if (!expanded && !loaded) {
      try {
        const items = await window.electronAPI.listAttachedDirectory(currentPath)
        setChildren(items)
        setLoaded(true)
      } catch (err) {
        console.error('[WorkspaceDirItem] 加载子目录失败:', err)
      }
    }
    setExpanded(!expanded)
  }

  const handleClick = (e: React.MouseEvent): void => {
    // Shift 多选时阻止默认文本选择行为
    if (e.shiftKey) {
      e.preventDefault()
    }
    onSelect(currentPath, e.ctrlKey || e.metaKey, e.shiftKey)
    if (entry.isDirectory && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      toggleDir()
    }
  }

  const handleDoubleClick = (): void => {
    if (!entry.isDirectory) {
      window.electronAPI.openAttachedFile(currentPath).catch(console.error)
    }
  }

  // 开始重命名
  const startRename = (): void => {
    setRenameValue(currentName)
    setIsRenaming(true)
    // 延迟聚焦，等待 DOM 渲染
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  // 确认重命名
  const confirmRename = async (): Promise<void> => {
    const newName = renameValue.trim()
    if (!newName || newName === currentName) {
      setIsRenaming(false)
      return
    }
    try {
      await window.electronAPI.renameAttachedFile(currentPath, newName)
      // 更新本地显示
      const parentDir = currentPath.substring(0, currentPath.lastIndexOf('/'))
      const newPath = `${parentDir}/${newName}`
      // 更新选中状态中的路径
      onSelect(newPath, false, false)
      setCurrentName(newName)
      setCurrentPath(newPath)
    } catch (err) {
      console.error('[WorkspaceDirItem] 重命名失败:', err)
    }
    setIsRenaming(false)
  }

  // 取消重命名
  const cancelRename = (): void => {
    setIsRenaming(false)
    setRenameValue(currentName)
  }

  // 移动到文件夹
  const handleMove = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.openFolderDialog()
      if (!result) return
      await window.electronAPI.moveAttachedFile(currentPath, result.path)
      // 移动后更新路径
      const newPath = `${result.path}/${currentName}`
      setCurrentPath(newPath)
    } catch (err) {
      console.error('[WorkspaceDirItem] 移动失败:', err)
    }
  }

  // 删除文件/目录
  const handleDelete = async (): Promise<void> => {
    try {
      await window.electronAPI.deleteAttachedFile(currentPath)
      // 通知父组件刷新（通过选择空路径触发）
      onSelect('', false, false)
    } catch (err) {
      console.error('[WorkspaceDirItem] 删除失败:', err)
    }
    setShowDeleteDialog(false)
  }

  const paddingLeft = 8 + depth * 16

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 py-1 pr-2 text-sm cursor-pointer group',
          isSelected ? 'bg-accent' : 'hover:bg-accent/50',
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {entry.isDirectory ? (
          <ChevronRight
            className={cn(
              'size-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        {entry.isDirectory ? (
          expanded ? (
            <FolderOpen className="size-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="size-4 text-amber-500 flex-shrink-0" />
          )
        ) : (
          <FileText className="size-4 text-muted-foreground flex-shrink-0" />
        )}

        {/* 名称：正常显示 / 重命名输入框 */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="text-xs flex-1 min-w-0 bg-background border border-primary rounded px-1 py-0.5 outline-none"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmRename()
              if (e.key === 'Escape') cancelRename()
              e.stopPropagation()
            }}
            onBlur={confirmRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-xs flex-1">{currentName}</span>
        )}

        {/* 三点菜单按钮 */}
        {isSelected && !isRenaming && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent/70"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 z-[9999] min-w-0 p-0.5">
                <DropdownMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5"
                  onSelect={() => window.electronAPI.showAttachedInFolder(currentPath).catch(console.error)}
                >
                  <FolderSearch />
                  在文件夹中显示
                </DropdownMenuItem>
                {!entry.isDirectory && (
                  <DropdownMenuItem
                    className="text-xs py-1 [&>svg]:size-3.5"
                    onSelect={() => window.electronAPI.openAttachedFile(currentPath).catch(console.error)}
                  >
                    <ExternalLink />
                    打开文件
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5"
                  onSelect={startRename}
                >
                  <Pencil />
                  重命名
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5"
                  onSelect={handleMove}
                >
                  <FolderInput />
                  移动到...
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5 text-destructive focus:text-destructive"
                  onSelect={() => setShowDeleteDialog(true)}
                >
                  <Trash2 />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {expanded && children.length === 0 && loaded && (
        <div
          className="text-[11px] text-muted-foreground/50 py-1"
          style={{ paddingLeft: paddingLeft + 24 }}
        >
          空文件夹
        </div>
      )}
      {expanded && children.map((child) => (
        <WorkspaceDirItem 
          key={child.path} 
          entry={child} 
          depth={depth + 1} 
          selectedPaths={selectedPaths} 
          onSelect={onSelect} 
          refreshVersion={refreshVersion}
          registerVisiblePath={registerVisiblePath}
          unregisterVisiblePath={unregisterVisiblePath}
        />
      ))}

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 <strong>{currentName}</strong> 吗？
              {entry.isDirectory && '（包含所有子文件）'}
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
