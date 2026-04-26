import type * as React from 'react'
import type * as Styles from '@/styles'
import type {IconType} from '@/common-adapters/icon.constants-gen'

export type MenuItem = {
  backgroundColor?: Styles.Color | undefined
  danger?: boolean | undefined
  decoration?: React.ReactNode | undefined // on the right side. unused if `view` is given,
  disabled?: boolean | undefined
  icon?: IconType | undefined
  iconIsVisible?: boolean | undefined
  iconStyle?: Styles.StylesCrossPlatform | undefined
  isBadged?: boolean | undefined
  isSelected?: boolean | undefined
  inProgress?: boolean | undefined
  newTag?: boolean | undefined
  onClick?: ((evt?: React.SyntheticEvent) => void) | undefined
  onPress?: never
  progressIndicator?: boolean | undefined
  style?: Styles.StylesCrossPlatform | undefined
  subTitle?: string | undefined
  rightTitle?: string | undefined
  title: string // Used only as ID if view is provided
  unWrapped?: boolean | undefined
  view?: React.ReactNode | undefined
}

export type _InnerMenuItem = MenuItem | 'Divider' | undefined
export type MenuItems = Array<_InnerMenuItem>

export type MenuLayoutProps = {
  isModal: false | 'modal' | 'bottomsheet'
  backgroundColor?: Styles.Color | undefined
  items: ReadonlyArray<_InnerMenuItem>
  header?: React.ReactNode | undefined
  onHidden: () => void
  closeOnClick?: boolean | undefined
  style?: object | undefined
  listStyle?: object | undefined
  closeText?: string | undefined // mobile only; default to "Close"
  textColor?: Styles.Color | undefined
  safeProviderStyle?: Styles.StylesCrossPlatform | undefined
}

declare const MenuLayout: (p: MenuLayoutProps) => React.ReactNode
export default MenuLayout
