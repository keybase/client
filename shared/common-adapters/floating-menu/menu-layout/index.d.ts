import * as React from 'react'
import {Color} from '../../../styles'
import {IconType, IconStyle} from '../../icon'

export type MenuItem = {
  backgroundColor?: Color
  danger?: boolean
  decoration?: React.ReactNode // on the right side. unused if `view` is given,
  disabled?: boolean
  icon?: IconType | null
  iconIsVisible?: boolean
  iconStyle?: IconStyle
  isBadged?: boolean
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
  backgroundColor?: Color
  items: MenuItems
  header?: React.ReactNode
  onHidden: () => void
  closeOnClick?: boolean
  style?: Object
  listStyle?: Object
  hoverColor?: string
  closeText?: string | null // mobile only; default to "Close"
  textColor?: Color
}

export default class MenuLayout extends React.Component<MenuLayoutProps> {}
