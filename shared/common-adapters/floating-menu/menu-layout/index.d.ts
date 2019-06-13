import * as React from 'react'

export type MenuItem = {
  danger?: boolean
  decoration?: React.ReactNode // on the right side. unused if `view` is given,
  disabled?: boolean
  newTag?: boolean | null
  onClick?: (evt?: React.SyntheticEvent) => void | null
  onPress?: void
  style?: Object
  subTitle?: string
  title: string // Only used as ID if view is provided for Header,
  view?: React.ReactNode // Required for header
}

type _InnerMenuItem = MenuItem | 'Divider' | null
export type MenuItems = ReadonlyArray<_InnerMenuItem>

export type MenuLayoutProps = {
  items: MenuItems
  header?: MenuItem | null
  onHidden: () => void
  closeOnClick?: boolean
  style?: Object
  hoverColor?: string
  closeText?: string | null // mobile only; default to "Close"
}

export default class MenuLayout extends React.Component<MenuLayoutProps> {}
