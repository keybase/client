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

export type {IconType} from './icon.constants-gen.shared.tsx'
export {iconMeta} from './icon.constants-gen.shared.tsx'
