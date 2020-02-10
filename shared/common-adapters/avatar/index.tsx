// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as React from 'react'
import Avatar from './render'
import {iconTypeToImgSet, urlsToImgSet, IconType} from '../icon'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as ProfileGen from '../../actions/profile-gen'
import './avatar.css'

export const avatarSizes = [128, 96, 64, 48, 32, 24, 16] as const
export type AvatarSize = typeof avatarSizes[number]

export type OwnProps = {
  borderColor?: string
  children?: React.ReactNode
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

const ConnectedAvatar = Container.connect(
  (state, ownProps: OwnProps) => ({
    _counter: state.config.avatarRefreshCounter.get(ownProps.username || ownProps.teamname || '') || 0,
    _httpSrvAddress: state.config.httpSrvAddress,
    _httpSrvToken: state.config.httpSrvToken,
    blocked: state.users?.blockMap?.get(ownProps.username || ownProps.teamname || '')?.chatBlocked,
    following: ownProps.showFollowingStatus ? state.config.following.has(ownProps.username || '') : false,
    followsYou: ownProps.showFollowingStatus ? state.config.followers.has(ownProps.username || '') : false,
  }),
  dispatch => ({
    _goToProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {username, showFollowingStatus, size, teamname, onEditAvatarClick, imageOverrideUrl} = ownProps
    const {lighterPlaceholders, borderColor, children, editable, loadingColor, opacity} = ownProps
    const {followsYou, following} = stateProps
    const {skipBackground, style} = ownProps
    const {_goToProfile} = dispatchProps
    const isTeam = ownProps.isTeam || !!teamname

    const opClick =
      ownProps.onClick === 'profile'
        ? username
          ? () => _goToProfile(username)
          : undefined
        : ownProps.onClick
    const onClick = onEditAvatarClick || opClick
    const name = isTeam ? teamname : username
    const sizes = [960, 256, 192] as const
    const urlMap = sizes.reduce<{[key: number]: string}>((m, size) => {
      m[size] = `http://${stateProps._httpSrvAddress}/av?typ=${
        isTeam ? 'team' : 'user'
      }&name=${name}&format=square_${size}&mode=${Styles.isDarkMode() ? 'dark' : 'light'}&token=${
        stateProps._httpSrvToken
      }&count=${stateProps._counter}`
      return m
    }, {})
    const url = imageOverrideUrl
      ? `url(${imageOverrideUrl})`
      : stateProps._httpSrvAddress && name
      ? urlsToImgSet(urlMap, size)
      : iconTypeToImgSet(
          isTeam ? teamPlaceHolders : lighterPlaceholders ? avatarLighterPlaceHolders : avatarPlaceHolders,
          size
        )
    return {
      blocked: stateProps.blocked,
      borderColor,
      children,
      editable,
      following,
      followsYou,
      isTeam,
      loadingColor,
      name: name || '',
      onClick,
      onEditAvatarClick,
      opacity,
      showFollowingStatus,
      size,
      skipBackground,
      style,
      url,
      username,
    }
  }
)(Avatar)

const mockOwnToViewProps = (
  ownProps: OwnProps,
  follows: string[],
  followers: string[],
  action: (arg0: string) => (...args: any[]) => void
) => {
  const {username} = ownProps
  const following = !!username && follows.includes(username)
  const followsYou = !!username && followers.includes(username)
  const isTeam = ownProps.isTeam || !!ownProps.teamname

  const opClick =
    ownProps.onClick === 'profile' ? (username ? action('onClickToProfile') : undefined) : ownProps.onClick
  const onClick = ownProps.onEditAvatarClick || opClick

  const url = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)
  const name = isTeam ? ownProps.teamname : username

  return {
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    following,
    followsYou,
    isTeam,
    loadingColor: ownProps.loadingColor,
    name: name || '',
    onClick,
    opacity: ownProps.opacity,
    showFollowingStatus: !!ownProps.showFollowingStatus,
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
