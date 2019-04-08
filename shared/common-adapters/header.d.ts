import * as React from 'react'

export type Props = {
  icon?: boolean,
  title?: string,
  onClose?: () => void,
  style?: Object,
  windowDragging?: boolean,
  type: "Default" | "Strong"
};

export type DefaultProps = {
  type: Props["type"]
};

export declare class Header extends React.Component<Props> {}
