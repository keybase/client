import {iconMeta as _iconMeta} from './icon.constants-gen.shared'
export type IconType = keyof typeof _iconMeta

type ReqOut = string | number
type IconMeta = {
  isFont?: boolean
  gridSize?: number
  extension?: string
  charCode?: number
  mults?: ReadonlyArray<number>
  nameDark?: IconType
  imagesDir?: string
  require?: ReqOut
  requireDark?: ReqOut
}
export const iconMeta = _iconMeta as unknown as {[k in IconType]: IconMeta}

// Which @Nx variants exist on disk for this asset. Callers must not offer a density with no
// file behind it: both srcSet and -webkit-image-set pick one candidate up front and render
// nothing if it 404s, they never fall back. Recorded by the generator only for the ~23 icons
// that don't ship all three.
const defaultMults: ReadonlyArray<number> = [1, 2, 3]
export const multsFor = (type: IconType): ReadonlyArray<number> => iconMeta[type].mults ?? defaultMults
