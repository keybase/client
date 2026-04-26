import type * as CSS from '@/styles/css'
import type * as React from 'react'
import type {MeasureRef} from './measure-ref'
import type {TextType} from './text.shared'

export type Props = {
  type?: TextType | undefined
  children?: React.ReactNode | undefined
  style?: CSS.StylesCrossPlatform | undefined
  allowFontScaling?: boolean | undefined
  onClick?: ((e: React.BaseSyntheticEvent) => void) | undefined
  onContextMenu?: ((e: React.BaseSyntheticEvent) => void) | undefined
  onLongPress?: (() => void) | undefined
  center?: boolean | undefined
  negative?: boolean | undefined
  lineClamp?: number | undefined
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' | undefined
  selectable?: boolean | undefined
  title?: string | undefined
  tooltip?: string | undefined
  textRef?: React.RefObject<MeasureRef | null> | undefined
  underline?: boolean | undefined
  underlineNever?: boolean | undefined
  virtualText?: boolean | undefined
  className?: string | undefined
}
export declare const Text: (p: Props) => React.ReactNode
export default Text
