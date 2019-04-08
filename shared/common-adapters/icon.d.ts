import * as React from 'react'
import {IconType} from './icon.constants'
import {StylesCrossPlatform, StylesCrossPlatformWithSomeDisallowed, Color} from '../styles'

export type SizeType = 'Big' | 'Default' | 'Small' | 'Tiny'

type DisallowedStyles = {
  color?: never
  hoverColor?: never
  fontSize?: never
}

export type Props = {
  type: IconType
  hint?: string
  noContainer?: boolean
  onClick?: (event: React.SyntheticEvent) => void | null
  onPress?: void
  onMouseEnter?: () => void | null
  onMouseLeave?: () => void | null
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  opacity?: boolean
  inheritColor?: boolean
  underlayColor?: string
  className?: string
  colorOverride?: Color
  color?: Color
  hoverColor?: string
  fontSize?: number
  boxStyle?: StylesCrossPlatform
  sizeType?: SizeType
}

export declare class Icon extends React.Component<Props> {}

export declare function iconTypeToImgSet(imgMap: {[K in string]: IconType}, targetSize: number): string

export declare function urlsToImgSet(imgMap: {[K in string]: string}, size: number): string | null

export declare function castPlatformStyles(
  styles: StylesCrossPlatform
): StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>

export {IconType} from './icon.constants'

export default Icon
