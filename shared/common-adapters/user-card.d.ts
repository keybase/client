
import React, {Component} from 'react'

export type Props = {
  onAvatarClicked?: () => void,
  outerStyle?: Object | null,
  style?: any,
  username?: string | null,
};

export declare class UserCard extends Component<Props> {}
