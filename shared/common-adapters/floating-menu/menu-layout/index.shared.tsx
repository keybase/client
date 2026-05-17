import type {IconType} from '@/common-adapters/icon.constants-gen'
import type * as React from 'react'
import type * as Styles from '@/styles'

export type MenuItem = {
  backgroundColor?: Styles.Color
  danger?: boolean
  decoration?: React.ReactNode
  disabled?: boolean
  icon?: IconType
  iconIsVisible?: boolean
  iconStyle?: Styles.StylesCrossPlatform
  isBadged?: boolean
  isSelected?: boolean
  inProgress?: boolean
  newTag?: boolean
  onClick?: (evt?: React.SyntheticEvent) => void
  onPress?: never
  progressIndicator?: boolean
  style?: Styles.StylesCrossPlatform
  subTitle?: string
  rightTitle?: string
  title: string
  unWrapped?: boolean
  view?: React.ReactNode
}

export type MenuItems = Array<_InnerMenuItem>

export type MenuLayoutProps = {
  isModal: false | 'modal' | 'bottomsheet'
  backgroundColor?: Styles.Color
  items: ReadonlyArray<_InnerMenuItem>
  header?: React.ReactNode
  onHidden: () => void
  closeOnClick?: boolean
  style?: object
  listStyle?: object
  closeText?: string
  textColor?: Styles.Color
  safeProviderStyle?: Styles.StylesCrossPlatform
}

export type _InnerMenuItem = MenuItem | 'Divider' | undefined
