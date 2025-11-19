import type * as React from 'react'
import type {IconType} from './icon.constants-gen'
import type {StylesCrossPlatform, Color, globalMargins, CustomStyles} from '@/styles'
import type {MeasureRef} from './measure-ref'

export type SizeType = 'Huge' | 'Bigger' | 'Big' | 'Default' | 'Small' | 'Tiny'

// These must be passed as props
export type DisallowedStyles = {
  color?: never
  hoverColor?: never
  fontSize?: never
}
export type IconStyle = CustomStyles<'color' | 'hoverColor' | 'fontSize'>

export type Props = {
  type: IconType
  hint?: string
  noContainer?: boolean
  onClick?: () => void
  onPress?: never // Use onClick, not onPress.,,
  onLongPress?: () => void // mobile only, rarely used just for debug currently
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  fixOverdraw?: boolean // use fastblank
  style?: IconStyle
  opacity?: boolean
  inheritColor?: boolean
  underlayColor?: string
  className?: string
  // Temporary hack that let's you override the color directly in the style instead of using css class names
  colorOverride?: Color
  color?: Color
  hoverColor?: string
  fontSize?: number
  // TODO cleanup how this container stuff works, this is to allow you to style the box that sometimes exists
  boxStyle?: StylesCrossPlatform
  // only applies to icon fonts
  sizeType?: SizeType
  padding?: keyof typeof globalMargins
  allowLazy?: boolean // desktop only
  tooltip?: never // doesn't play well with icon since it uses before also
  skipColor?: boolean // only used in one place, todo make an Icon2
}

export declare const Icon: ReturnType<typeof React.forwardRef<MeasureRef, Props>>
export default Icon

export declare function iconTypeToImgSet(imgMap: {[K in string]: IconType}, targetSize: number): string
export declare function urlsToImgSet(imgMap: {[K in string]: string}, size: number): string | null
export declare function urlsToSrcSet(_imgMap: {[key: number]: string}, _targetSize: number): string | null
export declare function urlsToBaseSrc(_imgMap: {[key: number]: string}, _targetSize: number): string | null
export type {IconType} from './icon.constants-gen'
