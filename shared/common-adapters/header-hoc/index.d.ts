import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
export type Action = {
  custom?: React.ReactNode
  label?: string // TODO: make this required after updates are fully integrated,
  color?: string // TODO: narrow this type
  icon?: IconType
  iconColor?: string
  onPress?: () => void
}
export type Props = {
  // TODO: remove these after updates are fully integrated
  onBack?: () => void
  onCancel?: () => void
  customCancelText?: string
  rightActionLabel?: string
  onRightAction?: () => void
  // keep these
  badgeNumber?: number
  borderless?: boolean
  titleComponent?: React.ReactNode
  title?: string
  leftAction?: 'back' | 'cancel' // defaults to 'back',
  onLeftAction?: () => void
  leftActionText?: string // defaults to 'cancel' when leftAction is 'cancel',
  hideBackLabel?: boolean
  customComponent?: React.ReactNode
  customSafeAreaBottomStyle?: StylesCrossPlatform // mobile only,
  customSafeAreaTopStyle?: StylesCrossPlatform // mobile only; use with `underNotch` route tag,
  headerStyle?: StylesCrossPlatform
  theme?: 'light' | 'dark' // defaults to 'light',
  rightActions?: Array<Action | undefined>
  // for nav2. if you use the actual header, its already safe so you can opt out of another safe
  underNotch?: boolean
}
export type LeftActionProps = {
  badgeNumber?: number
  disabled?: boolean
  customCancelText?: string
  hasTextTitle?: boolean
  hideBackLabel?: boolean
  leftAction?: 'back' | 'cancel'
  leftActionText?: string
  theme?: 'light' | 'dark' // defaults to 'light',
  onLeftAction?: () => void
  customIconColor?: string
  style?: StylesCrossPlatform
}

type HeaderHocProps = Props

/**
 * Short term use this instead of the hoc as a regular component
 */
export declare const HeaderHocWrapper: (
  p: Props & {children: React.ReactNode; skipHeader?: boolean}
) => React.ReactNode
export declare const HeaderHocHeader: (p: HeaderHocProps) => React.ReactNode
export declare const LeftAction: (p: LeftActionProps) => React.ReactNode
// HeaderHoc is deprecated. navigationOptions should be used instead.

// used in navigationOptions
export declare const HeaderLeftArrow: (p: HeaderBackButtonProps & {badgeNumber?: number}) => React.ReactNode
export declare const HeaderLeftBlank: () => React.ReactNode
export declare const HeaderLeftCancel: (p: HeaderBackButtonProps) => React.ReactNode
export declare const HeaderLeftCancel2: (p: HeaderBackButtonProps) => React.ReactNode

export type {HeaderBackButtonProps} from '@react-navigation/elements'
