import * as React from 'react'
import { StylesCrossPlatform } from '../styles';
import { IconType, Props as IconProps } from './icon';

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 16;

export type Props = {
  borderColor?: string | null,
  editable?: boolean,
  followIconSize: number,
  followIconType: IconType | null,
  followIconStyle: IconProps["style"] | null,
  isTeam: boolean,
  loadingColor?: string,
  onClick?: () => void | null,
  onEditAvatarClick?: (e: React.SyntheticEvent) => void | null,
  opacity?: number,
  size: AvatarSize,
  skipBackground?: boolean,
  skipBackgroundAfterLoaded?: boolean,
  style?: StylesCrossPlatform,
  url: any
};

export default class Avatar extends React.Component<Props> {}
