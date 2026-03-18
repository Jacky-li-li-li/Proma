/**
 * FileDropZone — 文件拖拽上传区域
 *
 * 支持拖拽文件/文件夹到目标目录。
 * 文件上传后直接保存到目标目录，FileBrowser 通过版本号自动刷新。
 */

import * as React from 'react'
import { toast } from 'sonner'
import { Upload, Loader2, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileToBase64 } from '@/lib/file-utils'

interface FileDropZoneProps {
  /** 当前工作区 slug（用于 IPC 调用） */
  workspaceSlug: string
  /** 当前会话 ID（session 模式必传） */
  sessionId?: string
  /** 上传目标：session（会话目录）或 workspace（工作区文件目录） */
  target?: 'session' | 'workspace'
  /** 上传成功后的回调（触发文件浏览器刷新） */
  onFilesUploaded: () => void
  /** 文件夹关联成功后的回调（用于更新界面状态） */
  onFoldersAttached?: (updatedDirs: string[]) => void
  /** 自定义类名 */
  className?: string
  /** 隐藏 UI（仅保留拖拽功能） */
  hideUI?: boolean
  /** 子元素 */
  children?: React.ReactNode
  /** 是否为空目录（为空时显示拖拽UI，有内容时隐藏UI但保留拖拽功能） */
  isEmpty?: boolean
}

export function FileDropZone({ 
  workspaceSlug, 
  sessionId, 
  target = 'session', 
  onFilesUploaded, 
  onFoldersAttached,
  className,
  hideUI,
  children,
  isEmpty,
}: FileDropZoneProps): React.ReactElement {
  console.log('[FileDropZone] Render, isEmpty:', isEmpty, 'children:', !!children, 'target:', target)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const isWorkspace = target === 'workspace'

  /** 保存文件到目标目录 */
  const saveFiles = React.useCallback(async (files: globalThis.File[]): Promise<void> => {
    if (files.length === 0) return

    setIsUploading(true)
    try {
      const fileEntries: Array<{ filename: string; data: string }> = []
      for (const file of files) {
        const base64 = await fileToBase64(file)
        fileEntries.push({ filename: file.name, data: base64 })
      }

      if (isWorkspace) {
        await window.electronAPI.saveFilesToWorkspaceFiles({
          workspaceSlug,
          files: fileEntries,
        })
      } else if (sessionId) {
        await window.electronAPI.saveFilesToAgentSession({
          workspaceSlug,
          sessionId,
          files: fileEntries,
        })
      } else {
        throw new Error('sessionId is required for session target')
      }

      onFilesUploaded()
      toast.success(`已添加 ${files.length} 个文件`)
    } catch (error) {
      console.error('[FileDropZone] 文件上传失败:', error)
      toast.error('文件上传失败')
    } finally {
      setIsUploading(false)
    }
  }, [workspaceSlug, sessionId, isWorkspace, onFilesUploaded])

  // ===== 拖拽处理 =====

  const handleDragOver = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = React.useCallback(async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const items = Array.from(e.dataTransfer.items)
    const regularFiles: globalThis.File[] = []
    let folderPaths: string[] = []

    for (const item of items) {
      if (item.kind !== 'file') continue
      const entry = item.webkitGetAsEntry?.()
      if (entry?.isDirectory) {
        // 对于工作区模式，获取文件夹路径
        if (isWorkspace && onFoldersAttached) {
          // 使用 Electron webUtils.getPathForFile 安全获取路径（contextIsolation 兼容）
          const file = item.getAsFile()
          if (file) {
            const path = window.electronAPI.getFilePath(file)
            if (path) {
              folderPaths.push(path)
            }
          }
        }
      } else {
        const file = item.getAsFile()
        if (file) regularFiles.push(file)
      }
    }

    // 工作区模式：拖拽文件夹时自动关联
    if (isWorkspace && folderPaths.length > 0 && onFoldersAttached) {
      let updatedDirs: string[] = []
      for (const folderPath of folderPaths) {
        try {
          // 从路径提取目录名
          const folderName = folderPath.split('/').pop() ?? '文件夹'
          // 调用关联文件夹 API，返回更新后的目录列表
          updatedDirs = await window.electronAPI.attachWorkspaceDirectory({
            workspaceSlug,
            directoryPath: folderPath,
          })
          toast.success(`已关联文件夹: ${folderName}`)
        } catch (error) {
          console.error('[FileDropZone] 关联文件夹失败:', error)
          toast.error('关联文件夹失败')
        }
      }
      // 通知父组件更新目录列表状态
      if (onFoldersAttached && updatedDirs.length > 0) {
        onFoldersAttached(updatedDirs)
      }
      onFilesUploaded()
      return
    }

    if (regularFiles.length > 0) {
      await saveFiles(regularFiles)
    }
  }, [saveFiles, isWorkspace, workspaceSlug, onFoldersAttached, onFilesUploaded])

  // ===== 按钮点击处理（选择文件）=====

  const handleSelectFiles = React.useCallback(async (): Promise<void> => {
    try {
      const result = await window.electronAPI.openFileDialog()
      if (result.files.length === 0) return

      setIsUploading(true)
      const fileEntries = result.files.map((f) => ({
        filename: f.filename,
        data: f.data,
      }))

      if (isWorkspace) {
        await window.electronAPI.saveFilesToWorkspaceFiles({
          workspaceSlug,
          files: fileEntries,
        })
      } else if (sessionId) {
        await window.electronAPI.saveFilesToAgentSession({
          workspaceSlug,
          sessionId,
          files: fileEntries,
        })
      } else {
        throw new Error('sessionId is required for session target')
      }

      onFilesUploaded()
      toast.success(`已添加 ${result.files.length} 个文件`)
    } catch (error) {
      console.error('[FileDropZone] 选择文件失败:', error)
      toast.error('文件上传失败')
    } finally {
      setIsUploading(false)
    }
  }, [workspaceSlug, sessionId, isWorkspace, onFilesUploaded])

  // 拖拽遮罩层（拖拽时显示）
  const dragOverlay = isDragOver && (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-primary/5 border-2 border-primary border-dashed rounded-xl">
      <FolderOpen className="size-8 text-primary" />
      <span className="text-sm text-primary font-medium">释放以关联文件/文件夹</span>
    </div>
  )

  // 上传中遮罩层
  const uploadingOverlay = isUploading && (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-background/80 rounded-xl">
      <Loader2 className="size-6 text-muted-foreground animate-spin" />
      <span className="text-xs text-muted-foreground">正在上传...</span>
    </div>
  )

  // 有子元素时的渲染
  if (children) {
    // 非空时（isEmpty=false 或 hideUI=true）：隐藏拖拽 UI 但保留功能
    if (isEmpty === false || hideUI) {
      return (
        <div 
          className={cn('relative h-full', className)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {children}
          {dragOverlay}
          {uploadingOverlay}
        </div>
      )
    }
    
    // 空目录时：只显示拖拽 UI，不渲染 children（避免背景遮挡）
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <div
          className={cn(
            'relative flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-3 py-4',
            'transition-colors duration-200',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/20 hover:border-muted-foreground/40',
            isUploading && 'pointer-events-none opacity-60',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isWorkspace ? (
            <FolderOpen className={cn(
              'size-8 transition-colors',
              isDragOver ? 'text-primary' : 'text-muted-foreground/40',
            )} />
          ) : (
            <Upload className={cn(
              'size-8 transition-colors',
              isDragOver ? 'text-primary' : 'text-muted-foreground/40',
            )} />
          )}
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            拖拽文件或文件夹到此处
            <br />
            <span className="text-[10px] text-muted-foreground/50">
              {isWorkspace ? '工作区内所有会话可访问' : '供 Agent 读取和处理'}
            </span>
          </p>
          {dragOverlay}
          {uploadingOverlay}
        </div>
      </div>
    )
  }

  // 无子元素时：默认显示拖拽区域 UI
  return (
    <div className={cn('h-full flex flex-col', className)}>
      <div
        className={cn(
          'relative flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-3 py-4',
          'transition-colors duration-200',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/20 hover:border-muted-foreground/40',
          isUploading && 'pointer-events-none opacity-60',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isWorkspace ? (
          <FolderOpen className={cn(
            'size-8 transition-colors',
            isDragOver ? 'text-primary' : 'text-muted-foreground/40',
          )} />
        ) : (
          <Upload className={cn(
            'size-8 transition-colors',
            isDragOver ? 'text-primary' : 'text-muted-foreground/40',
          )} />
        )}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          拖拽文件或文件夹到此处
          <br />
          <span className="text-[10px] text-muted-foreground/50">
            {isWorkspace ? '工作区内所有会话可访问' : '供 Agent 读取和处理'}
          </span>
        </p>
        {dragOverlay}
        {uploadingOverlay}
      </div>
    </div>
  )
}
