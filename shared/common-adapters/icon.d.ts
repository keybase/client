import * as React from 'react'
import {IconType} from './icon.constants'
import {StylesCrossPlatform, StylesCrossPlatformWithSomeDisallowed, Color, globalMargins} from '../styles'

export type SizeType = 'Huge' | 'Bigger' | 'Big' | 'Default' | 'Small' | 'Tiny'

// These must be passed as props
export type DisallowedStyles = {
  color?: never
  hoverColor?: never
  fontSize?: never
}
export type IconStyle = StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>

export type Props = {
  type: IconType
  hint?: string
  noContainer?: boolean
  onClick?: ((event: React.BaseSyntheticEvent) => void) | null
  onPress?: void // Use onClick, not onPress.,,
  onMouseEnter?: (() => void) | null
  onMouseLeave?: (() => void) | null
  style?: IconStyle
  opacity?: boolean
  inheritColor?: boolean
  underlayColor?: string
  className?: string
  // Temporary hack that let's you override the color directly in the style instead of using css class names
  colorOverride?: Color
  color?: Color
  hoverColor?: string | null
  fontSize?: number
  // TODO cleanup how this container stuff works, this is to allow you to style the box that sometimes exists
  boxStyle?: StylesCrossPlatform
  // only applies to icon fonts
  sizeType?: SizeType
  padding?: keyof typeof globalMargins
}

declare class Icon extends React.Component<Props> {
  defaultProps: {
    sizeType: 'Default'
  }
}

export default Icon

export declare function iconTypeToImgSet(imgMap: {[K in string]: IconType}, targetSize: number): string

export declare function urlsToImgSet(imgMap: {[K in string]: string}, size: number): string | null

export declare function castPlatformStyles(
  styles: StylesCrossPlatform
): StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>

export {IconType} from './icon.constants'
