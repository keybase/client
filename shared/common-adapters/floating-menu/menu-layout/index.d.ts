import type * as React from 'react'
import type * as Styles from '@/styles'
import type {IconType, IconStyle} from '@/common-adapters/icon'

export type MenuItem = {
  backgroundColor?: Styles.Color
  danger?: boolean
  decoration?: React.ReactNode // on the right side. unused if `view` is given,
  disabled?: boolean
  icon?: IconType
  iconIsVisible?: boolean
  iconStyle?: IconStyle
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
  title: string // Used only as ID if view is provided
  unWrapped?: boolean
  view?: React.ReactNode
}

export type _InnerMenuItem = MenuItem | 'Divider' | undefined
export type MenuItems = Array<_InnerMenuItem>

export type MenuLayoutProps = {
  isModal: boolean | 'bottomsheet'
  backgroundColor?: Styles.Color
  items: ReadonlyArray<_InnerMenuItem>
  header?: React.ReactNode
  onHidden: () => void
  closeOnClick?: boolean
  style?: object
  listStyle?: object
  closeText?: string // mobile only; default to "Close"
  textColor?: Styles.Color
  safeProviderStyle?: Styles.StylesCrossPlatform
}

declare const MenuLayout: (p: MenuLayoutProps) => React.ReactNode
export default MenuLayout
