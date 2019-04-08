import * as React from 'react'

export type MenuItem = {
  danger?: boolean,
  disabled?: boolean,
  newTag?: boolean | null,
  onClick?: (evt?: React.SyntheticEvent) => void | null,
  onPress?: void,
  style?: Object,
  subTitle?: string,
  title: string,
  view?: React.ElementType
};

export type MenuItems = Array<MenuItem | "Divider" | null>;

export type MenuLayoutProps = {
  items: MenuItems,
  header?: MenuItem | null,
  onHidden: () => void,
  closeOnClick?: boolean,
  style?: Object,
  hoverColor?: string,
  closeText?: string | null
};

export default class MenuLayout extends React.Component<MenuLayoutProps> {}
