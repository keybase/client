import * as React from 'react'
import {IconType} from './icon'

export type ItemProps = {
  tabBarButton?: React.ReactNode
  label?: string
  selected: boolean
  selectedColor?: string
  onClick?: () => void
  onPress?: void
  style?: Object
  styleContainer?: Object
  children?: React.ReactNode
  onBottom?: boolean
  underlined?: boolean
}

export default class TabBar extends React.Component<Props> {}

export class TabBarItem extends React.Component<ItemProps> {}

export type Props = {
  style?: Object | null
  styleTabBar?: Object
  children?: Array<React.ReactElement<React.ComponentProps<typeof TabBarItem>>>
  tabBarOnBottom?: boolean
  underlined?: boolean
}

export type TabBarButtonSource =
  | {type: 'icon'; icon: IconType}
  | {type: 'avatar'; username?: string}
  | {type: 'nav'; icon: IconType}

export type TabBadgePosition = 'top-right'

export type TabBarButtonProps = {
  className?: string
  underlined?: boolean | null
  isNav?: boolean
  isNew: boolean
  selected: boolean
  onClick?: () => void
  source: TabBarButtonSource
  label?: string
  badgeNumber?: number | null
  badgePosition?: TabBadgePosition
  style?: Object
  styleContainer?: any
  styleBadge?: any
  styleBadgeContainer?: any
  styleIcon?: any
  styleBadgeNumber?: any
  styleLabel?: any
}

export class TabBarButton extends React.Component<TabBarButtonProps> {}
