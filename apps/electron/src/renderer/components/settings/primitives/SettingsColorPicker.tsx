/**
 * SettingsColorPicker - 颜色选择器原语
 *
 * 提供颜色选择功能，包括：
 * - 原生 color input 选择任意颜色
 * - 预设颜色快速选择
 * - 重置为默认（空值）
 */

import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** 预设颜色选项 */
const PRESET_COLORS = [
  '#3b82f6', // 蓝色
  '#10b981', // 绿色
  '#f59e0b', // 橙色
  '#ef4444', // 红色
  '#8b5cf6', // 紫色
  '#ec4899', // 粉色
  '#06b6d4', // 青色
  '#84cc16', // 青柠
]

interface SettingsColorPickerProps {
  /** 当前颜色值（空字符串表示使用默认） */
  value: string
  /** 颜色变化回调 */
  onChange: (value: string) => void
  /** 是否允许清空/重置 */
  allowClear?: boolean
}

/**
 * 颜色选择器组件
 */
export function SettingsColorPicker({
  value,
  onChange,
  allowClear = true,
}: SettingsColorPickerProps): React.ReactElement {
  const colorInputRef = React.useRef<HTMLInputElement>(null)

  /** 处理颜色变化 */
  const handleColorChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  /** 处理预设颜色点击 */
  const handlePresetClick = React.useCallback(
    (color: string) => {
      onChange(color)
    },
    [onChange]
  )

  /** 处理重置 */
  const handleReset = React.useCallback(() => {
    onChange('')
  }, [onChange])

  /** 点击颜色预览打开选择器 */
  const handlePreviewClick = React.useCallback(() => {
    colorInputRef.current?.click()
  }, [])

  // 当前是否有自定义颜色
  const hasCustomColor = value && value !== ''

  return (
    <div className="flex items-center gap-3">
      {/* 颜色选择器 */}
      <div className="flex items-center gap-2">
        {/* 颜色预览/选择按钮 */}
        <button
          type="button"
          onClick={handlePreviewClick}
          className={cn(
            'relative w-9 h-9 rounded-lg border-2 transition-all',
            'hover:scale-105 active:scale-95',
            hasCustomColor ? 'border-transparent' : 'border-dashed border-muted-foreground/30'
          )}
          style={{
            backgroundColor: hasCustomColor ? value : 'transparent',
          }}
          title={hasCustomColor ? value : '选择颜色'}
        >
          {!hasCustomColor && (
            <span className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-lg">
              +
            </span>
          )}
        </button>

        {/* 隐藏的原生 color input */}
        <input
          ref={colorInputRef}
          type="color"
          value={value || '#3b82f6'}
          onChange={handleColorChange}
          className="sr-only"
          aria-label="选择颜色"
        />

        {/* 预设颜色 */}
        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handlePresetClick(color)}
              className={cn(
                'w-5 h-5 rounded-full transition-all',
                'hover:scale-110 active:scale-95',
                'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary',
                value === color && 'ring-2 ring-offset-1 ring-primary scale-110'
              )}
              style={{ backgroundColor: color }}
              title={color}
              aria-label={`选择颜色 ${color}`}
            />
          ))}
        </div>
      </div>

      {/* 重置按钮 */}
      {allowClear && hasCustomColor && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleReset}
          title="恢复默认"
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
