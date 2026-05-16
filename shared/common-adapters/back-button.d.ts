import type * as React from 'react'
import type {Color, StylesCrossPlatform} from '@/styles'

export type Props = {
  badgeNumber?: number
  hideBackLabel?: boolean
  onClick?: () => void // if undefined will give you a navigate up
  disabled?: boolean
  onPress?: never
  iconColor?: Color
  textStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
  title?: string
}

declare const BackButton: (p: Props) => React.ReactNode
export default BackButton
