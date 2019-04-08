import * as React from 'react'
import { Color, StylesCrossPlatform } from '../styles';

export type Props = {
  badgeNumber?: number,
  hideBackLabel?: boolean,
  onClick: () => void | null,
  onPress?: void,
  iconColor?: Color,
  textStyle?: StylesCrossPlatform | null,
  style?: StylesCrossPlatform | null,
  title?: string | null
};

export declare class BackButton extends React.Component<Props> {}
