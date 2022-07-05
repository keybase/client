import * as React from 'react'
import {Color, StylesCrossPlatform} from '../styles'

export type Props = {
  badgeNumber?: number
  hideBackLabel?: boolean
  onClick?: () => void // if undefined will give you a navigate up
  disabled?: boolean
  onPress?: void
  iconColor?: Color
  textStyle?: StylesCrossPlatform | null
  style?: StylesCrossPlatform | null
  title?: string | null
}

declare class BackButton extends React.Component<Props> {}
export default BackButton
