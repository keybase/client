// @ts-nocheck
import {iconMeta as _iconMeta} from './icon.constants-gen.shared'
export type {IconType} from './icon.constants-gen.shared'
import type {IconType} from './icon.constants-gen.shared'

export type IconMeta = {
  isFont?: boolean
  gridSize?: number
  extension?: string
  charCode?: number
  nameDark?: string
  imagesDir?: string
  require?: string | number
  requireDark?: string | number
}

export const iconMeta: Record<IconType, IconMeta> = _iconMeta
