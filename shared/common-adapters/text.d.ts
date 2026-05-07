import type * as CSS from '@/styles/css'
import type * as React from 'react'
import type {MeasureRef} from './measure-ref'
import type {TextType} from './text.shared'

export type Props = {
  type?: TextType
  children?: React.ReactNode
  style?: CSS.StylesCrossPlatform
  allowFontScaling?: boolean
  onClick?: (e: React.BaseSyntheticEvent) => void
  onContextMenu?: (e: React.BaseSyntheticEvent) => void
  onLongPress?: () => void
  center?: boolean
  negative?: boolean
  lineClamp?: number
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
  selectable?: boolean
  title?: string
  tooltip?: string
  textRef?: React.RefObject<MeasureRef | null>
  underline?: boolean
  underlineNever?: boolean
  virtualText?: boolean
  className?: string
}
export declare const Text: (p: Props) => React.ReactNode
export default Text
