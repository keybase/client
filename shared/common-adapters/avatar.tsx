// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as React from 'react'
import Avatar from './avatar.render'
import {iconTypeToImgSet, urlsToImgSet, IconType, IconStyle} from './icon'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as ProfileGen from '../actions/profile-gen'
import * as Types from '../constants/types/teams'
import './avatar.css'

// Desktop sizes also imported for edit-avatar
export const AVATAR_CONTAINER_SIZE = 175
export const AVATAR_BORDER_SIZE = 4
export const AVATAR_SIZE = AVATAR_CONTAINER_SIZE - AVATAR_BORDER_SIZE * 2
export const VIEWPORT_CENTER = AVATAR_SIZE / 2

export const avatarSizes = [128, 96, 64, 48, 32, 24, 16] as const
export type AvatarSize = typeof avatarSizes[number]

type URLType = string

export type OwnProps = {
  borderColor?: string
  children?: React.ReactNode
  crop?: Types.AvatarCrop
  lighterPlaceholders?: boolean
  editable?: boolean
  imageOverrideUrl?: string
  isTeam?: boolean
  loadingColor?: string
  onClick?: ((e?: React.BaseSyntheticEvent) => void) | 'profile'
  onEditAvatarClick?: (e?: React.BaseSyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  style?: Styles.CustomStyles<'borderStyle', {}>
  teamname?: string
  username?: string
  showFollowingStatus?: boolean // show the green dots or not
}

export type Props = {
  borderColor?: string
  children?: React.ReactNode
  crop?: Types.AvatarCrop
  editable?: boolean
  followIconSize: number
  followIconType?: IconType
  followIconStyle: IconStyle
  imageOverride?: string
  isTeam: boolean
  loadingColor?: string
  name: string
  onClick?: (e?: React.SyntheticEvent) => void
  onEditAvatarClick?: (e?: React.SyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  style?: Styles.CustomStyles<'borderStyle', {}>
  teamname?: string
  url: URLType
  username?: string
}

const avatarPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-placeholder-avatar-192',
  '256': 'icon-placeholder-avatar-256',
  '960': 'icon-placeholder-avatar-960',
}

const avatarLighterPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-placeholder-avatar-lighter-192',
  '256': 'icon-placeholder-avatar-lighter-256',
  '960': 'icon-placeholder-avatar-lighter-960',
}

const teamPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-team-placeholder-avatar-192',
  '256': 'icon-team-placeholder-avatar-256',
  '960': 'icon-team-placeholder-avatar-960',
}

const followSizeToStyle = new Map<AvatarSize, IconStyle>([
  [128, {bottom: 0, left: 88, position: 'absolute'}],
  [48, {bottom: 0, left: 30, position: 'absolute'}],
  [64, {bottom: 0, left: 44, position: 'absolute'}],
  [96, {bottom: 0, left: 65, position: 'absolute'}],
])

const followIconHelper = (
  size: AvatarSize,
  followsYou: boolean,
  following: boolean
): {
  iconSize: 28 | 21
  iconStyle: IconStyle
  iconType: IconType | undefined
} => {
  const iconSize = size === 128 ? 28 : 21
  const rel =
    followsYou === following ? (followsYou ? 'mutual-follow' : null) : followsYou ? 'follow-me' : 'following'
  const iconType: IconType | undefined = rel ? (`icon-${rel}-${iconSize}` as any) : undefined
  const iconStyle = followSizeToStyle.get(size)
  return {
    iconSize,
    iconStyle,
    iconType,
  }
}

const ConnectedAvatar = Container.connect(
  (state, ownProps: OwnProps) => ({
    _counter: state.config.avatarRefreshCounter.get(ownProps.username || ownProps.teamname || '') || 0,
    _following: ownProps.showFollowingStatus ? state.config.following.has(ownProps.username || '') : false,
    _followsYou: ownProps.showFollowingStatus ? state.config.followers.has(ownProps.username || '') : false,
    _httpSrvAddress: state.config.httpSrvAddress,
    _httpSrvToken: state.config.httpSrvToken,
    blocked: state.users?.blockMap?.get(ownProps.username || ownProps.teamname || '')?.chatBlocked,
  }),
  dispatch => ({
    _goToProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {username} = ownProps
    const isTeam = ownProps.isTeam || !!ownProps.teamname

    const opClick =
      ownProps.onClick === 'profile'
        ? username
          ? () => dispatchProps._goToProfile(username)
          : undefined
        : ownProps.onClick
    const onClick = ownProps.onEditAvatarClick || opClick
    const name = isTeam ? ownProps.teamname : username
    const sizes = [960, 256, 192] as const
    const urlMap = sizes.reduce<{[key: number]: string}>((m, size) => {
      m[size] = `http://${stateProps._httpSrvAddress}/av?typ=${
        isTeam ? 'team' : 'user'
      }&name=${name}&format=square_${size}&mode=${Styles.isDarkMode() ? 'dark' : 'light'}&token=${
        stateProps._httpSrvToken
      }&count=${stateProps._counter}`
      return m
    }, {})
    const url = ownProps.imageOverrideUrl
      ? `url("${encodeURI(ownProps.imageOverrideUrl)}")`
      : stateProps._httpSrvAddress && name
      ? urlsToImgSet(urlMap, ownProps.size)
      : iconTypeToImgSet(
          isTeam
            ? teamPlaceHolders
            : ownProps.lighterPlaceholders
            ? avatarLighterPlaceHolders
            : avatarPlaceHolders,
          ownProps.size
        )
    const iconInfo = followIconHelper(ownProps.size, stateProps._followsYou, stateProps._following)
    return {
      blocked: stateProps.blocked,
      borderColor: ownProps.borderColor,
      children: ownProps.children,
      crop: ownProps.crop,
      editable: ownProps.editable,
      followIconSize: iconInfo.iconSize,
      followIconStyle: iconInfo.iconStyle,
      followIconType: iconInfo.iconType,
      isTeam,
      loadingColor: ownProps.loadingColor,
      name: name || '',
      onClick,
      onEditAvatarClick: ownProps.onEditAvatarClick,
      opacity: ownProps.opacity,
      size: ownProps.size,
      skipBackground: ownProps.skipBackground,
      style: ownProps.style,
      url,
    }
  }
)(Avatar)

const mockOwnToViewProps = (
  ownProps: OwnProps,
  follows: string[],
  followers: string[],
  action: (arg0: string) => (...args: any[]) => void
): Props => {
  const {username} = ownProps
  const following = username && follows.includes(username)
  const followsYou = username && followers.includes(username)
  const isTeam = ownProps.isTeam || !!ownProps.teamname

  const opClick =
    ownProps.onClick === 'profile' ? (username ? action('onClickToProfile') : undefined) : ownProps.onClick
  const onClick = ownProps.onEditAvatarClick || opClick

  const url = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)
  const name = isTeam ? ownProps.teamname : username
  const iconInfo = followIconHelper(
    ownProps.size,
    !!(ownProps.showFollowingStatus && followsYou),
    !!(ownProps.showFollowingStatus && following)
  )

  const followIconType: IconType | undefined = iconInfo.iconType || undefined
  return {
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    followIconSize: iconInfo.iconSize,
    followIconStyle: iconInfo.iconStyle,
    followIconType,
    isTeam,
    loadingColor: ownProps.loadingColor,
    name: name || '',
    onClick,
    opacity: ownProps.opacity,
    size: ownProps.size,
    style: ownProps.style,
    url,
  }
}

export default ConnectedAvatar
export {mockOwnToViewProps}

export function castPlatformStyles(styles: any) {
  return styles
}
