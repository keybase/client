// This facade is needed because flow is getting confused about the connector. TODO clean up the connector typing
import * as React from 'react'
import {StylesCrossPlatform, StylesCrossPlatformWithSomeDisallowed} from '../styles'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16 | 12

type DisallowedStyles = {
  borderStyle?: never
}

export type Props = {
  borderColor?: string | null
  children?: React.ReactNode
  clickToProfile?: 'tracker' | 'profile' // If set, go to profile on mobile and tracker/profile on desktop,,,
  editable?: boolean
  isTeam?: boolean
  loadingColor?: string
  onClick?: (e?: React.SyntheticEvent) => void
  onEditAvatarClick?: ((e?: React.SyntheticEvent) => void )| null
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean // if we're on a white background we don't need a white back cover,,,
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  teamname?: string | null
  username?: string | null
  showFollowingStatus?: boolean // show the green dots or not
}

export default class Avatar extends React.Component<Props> {}

export declare function mockOwnToViewProps(
  ownProps: Props,
  follows: string[],
  followers: string[],
  action: (arg0: string) => (...args: any[]) => void
): any

export declare function castPlatformStyles(
  styles: StylesCrossPlatform
): StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
