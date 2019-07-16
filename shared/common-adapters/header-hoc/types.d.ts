import * as React from 'react'
import {StylesCrossPlatform} from '../../styles'
import {IconType} from '../icon.constants'
export type Action = {
  custom?: React.ReactNode
  label?: string // TODO: make this required after updates are fully integrated,
  color?: string // TODO: narrow this type
  icon?: IconType
  iconColor?: string
  onPress?: (() => void) | null
}
export type Props = {
  // TODO: remove these after updates are fully integrated
  onBack?: (() => void) | null
  onCancel?: (() => void) | null
  customCancelText?: string
  rightActionLabel?: string
  onRightAction?: (() => void) | null
  // keep these
  badgeNumber?: number
  borderless?: boolean
  titleComponent?: React.ReactNode
  title?: string
  leftAction?: 'back' | 'cancel' // defaults to 'back',
  onLeftAction?: (() => void) | null
  leftActionText?: string // defaults to 'cancel' when leftAction is 'cancel',
  hideBackLabel?: boolean
  customComponent?: React.ReactNode | null
  customSafeAreaBottomStyle?: StylesCrossPlatform // mobile only,
  customSafeAreaTopStyle?: StylesCrossPlatform // mobile only; use with `underNotch` route tag,
  headerStyle?: StylesCrossPlatform
  theme?: 'light' | 'dark' // defaults to 'light',
  rightActions?: Array<Action | null>
  // for nav2. if you use the actual header, its already safe so you can opt out of another safe
  underNotch?: boolean
}
export type LeftActionProps = {
  badgeNumber?: number
  disabled?: boolean
  customCancelText?: string
  hasTextTitle?: boolean
  hideBackLabel?: boolean
  leftAction?: 'back' | 'cancel' | null
  leftActionText?: string
  theme?: 'light' | 'dark' // defaults to 'light',
  onLeftAction: (() => void) | null
  customIconColor?: string
}
