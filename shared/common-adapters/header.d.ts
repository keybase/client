import * as React from 'react'

export type HeaderType = 'Default' | 'Strong'
export type Props = {
  icon?: boolean
  title?: string
  onClose?: () => void
  style?: Object
  children?: React.ReactNode
  windowDragging?: boolean
  type: HeaderType
}

export type DefaultProps = {
  type: HeaderType
}

export default class Header extends React.Component<Props> {
  static defaultProps: DefaultProps
}
