import * as React from 'react'
import * as Styles from '../../../styles'
import {IconType, IconStyle} from '../../icon'

export type MenuItem = {
  backgroundColor?: Styles.Color
  danger?: boolean
  decoration?: React.ReactNode // on the right side. unused if `view` is given,
  disabled?: boolean
  icon?: IconType | null
  iconIsVisible?: boolean
  iconStyle?: IconStyle
  isBadged?: boolean
  isSelected?: boolean
  inProgress?: boolean
  newTag?: boolean | null
  onClick?: ((evt?: React.SyntheticEvent) => void) | null
  onPress?: void
  progressIndicator?: boolean
  style?: Object
  subTitle?: string
  title: string // Used only as ID if view is provided
  unWrapped?: boolean
  view?: React.ReactNode
}

type _InnerMenuItem = MenuItem | 'Divider' | null
export type MenuItems = Array<_InnerMenuItem>

export type MenuLayoutProps = {
  backgroundColor?: Styles.Color
  items: ReadonlyArray<_InnerMenuItem>
  header?: React.ReactNode
  onHidden: () => void
  closeOnClick?: boolean
  style?: Object
  listStyle?: Object
  hoverColor?: string
  closeText?: string | null // mobile only; default to "Close"
  textColor?: Styles.Color
  safeProviderStyle?: Styles.StylesCrossPlatform
}

export default class MenuLayout extends React.Component<MenuLayoutProps> {}
