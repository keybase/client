import {iconMeta as _iconMeta} from './icon.constants-gen.shared'
export type IconType = keyof typeof _iconMeta

type ReqOut = string | number
type IconMeta = {
  isFont?: boolean
  gridSize?: number
  extension?: string
  charCode?: number
  nameDark?: string
  imagesDir?: string
  require?: ReqOut
  requireDark?: ReqOut
}
export const iconMeta = _iconMeta as unknown as {[k in IconType]: IconMeta}
