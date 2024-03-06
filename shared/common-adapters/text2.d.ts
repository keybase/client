import type * as CSS from '@/styles/css'
import type * as React from 'react'
import type {TextType} from './text.shared'

type Props = {
  children?: React.ReactNode // ideally just Text2 and string but this isn't easy
  title?: string
  className?: string
  ref?: never
  onClick?: never
  onClickURL?: never
  onLongPress?: never
  onLongPressURL?: never
  onPress?: never
  style?: CSS.StylesCrossPlatform
  type?: TextType
  lineClamp?: number
  selectable?: boolean
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' // mobile only, defines how ellipsis will be put in if `lineClamp` is supplied,,
  virtualText?: boolean // desktop only
}
export declare const Text2: (p: Props) => React.ReactNode
