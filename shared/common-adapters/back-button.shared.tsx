import type {Color, StylesCrossPlatform} from '@/styles'

export type Props = {
  badgeNumber?: number
  hideBackLabel?: boolean
  onClick?: () => void
  disabled?: boolean
  onPress?: never
  iconColor?: Color
  textStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
  title?: string
}
