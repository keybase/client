// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as React from 'react'
import Avatar from './avatar.render'
import {iconTypeToImgSet, urlsToImgSet, IconType, IconStyle} from './icon'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16
type URLType = string

type DisallowedStyles = {
  borderStyle?: never
}

export type OwnProps = {
  borderColor?: string
  children?: React.ReactNode
  clickToProfile?: 'tracker' | 'profile' // If set, go to profile on mobile and tracker/profile on desktop,,,
  editable?: boolean
  isTeam?: boolean
  loadingColor?: string
  onClick?: (e?: React.BaseSyntheticEvent) => void
  onEditAvatarClick?: (e?: React.BaseSyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean // if we're on a white background we don't need a white back cover,,,
  style?: Styles.StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  teamname?: string
  username?: string
  showFollowingStatus?: boolean // show the green dots or not
}

type Props = {
  askForUserData?: () => void
  borderColor?: string
  children?: React.ReactNode
  editable?: boolean
  followIconSize: number
  followIconType?: IconType
  followIconStyle: IconStyle
  isTeam: boolean
  loadingColor?: string
  name: string
  onClick?: (e?: React.SyntheticEvent) => void
  onEditAvatarClick?: (e?: React.SyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean // if we're on a white background we don't need a white back cover,,,
  style?: Styles.StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  teamname?: string
  url: URLType
  username?: string
}

const avatarPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-placeholder-avatar-192',
  '256': 'icon-placeholder-avatar-256',
  '960': 'icon-placeholder-avatar-960',
}

const teamPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-team-placeholder-avatar-192',
  '256': 'icon-team-placeholder-avatar-256',
  '960': 'icon-team-placeholder-avatar-960',
}

const followSizeToStyle = {
  '128': {bottom: 0, left: 88, position: 'absolute'},
  '48': {bottom: 0, left: 30, position: 'absolute'},
  '64': {bottom: 0, left: 44, position: 'absolute'},
  '96': {bottom: 0, left: 65, position: 'absolute'},
}

const followIconHelper = (size: number, followsYou: boolean, following: boolean) => {
  const iconSize = size === 128 ? 28 : 21
  const rel =
    followsYou === following ? (followsYou ? 'mutual-follow' : null) : followsYou ? 'follow-me' : 'following'
  // @ts-ignore can't infer this string is a valid icon, but its ok. we'll
  // catch it in snapshots if this is wrong
  const iconType: IconType | undefined = rel ? `icon-${rel}-${iconSize}` : undefined
  return {
    iconSize,
    iconStyle: followSizeToStyle[size] as IconStyle,
    iconType,
  }
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  return {
    _counter: state.config.avatarRefreshCounter.get(ownProps.username || ownProps.teamname || '', 0),
    _following: ownProps.showFollowingStatus ? state.config.following.has(ownProps.username || '') : false,
    _followsYou: ownProps.showFollowingStatus ? state.config.followers.has(ownProps.username || '') : false,
    _httpSrvAddress: state.config.httpSrvAddress,
    _httpSrvToken: state.config.httpSrvToken,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
  return {
    _goToProfile: (username: string, desktopDest: 'profile' | 'tracker') =>
      Styles.isMobile || desktopDest === 'profile'
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
    onClick: ownProps.onEditAvatarClick ? ownProps.onEditAvatarClick : ownProps.onClick,
  }
}

const avatarSizes = [960, 256, 192]
const ConnectedAvatar = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const isTeam = ownProps.isTeam || !!ownProps.teamname

    let onClick = dispatchProps.onClick
    if (!onClick && ownProps.clickToProfile && ownProps.username) {
      const u = ownProps.username
      const desktopDest = ownProps.clickToProfile
      onClick = () => dispatchProps._goToProfile(u, desktopDest)
    }

    const style: Styles.StylesCrossPlatform = Styles.isMobile
      ? ownProps.style
      : Styles.collapseStyles([
          ownProps.style,
          onClick && Styles.platformStyles({isElectron: Styles.desktopStyles.clickable}),
        ])

    const name = isTeam ? ownProps.teamname : ownProps.username
    const urlMap = avatarSizes.reduce((m, size: number) => {
      m[size] = `http://${stateProps._httpSrvAddress}/av?typ=${
        isTeam ? 'team' : 'user'
      }&name=${name}&format=square_${size}&token=${stateProps._httpSrvToken}&count=${stateProps._counter}`
      return m
    }, {})
    let url = stateProps._httpSrvAddress
      ? urlsToImgSet(urlMap, ownProps.size)
      : iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)
    const iconInfo = followIconHelper(ownProps.size, stateProps._followsYou, stateProps._following)
    return {
      borderColor: ownProps.borderColor,
      children: ownProps.children,
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
      skipBackgroundAfterLoaded: ownProps.skipBackgroundAfterLoaded,
      style,
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
  const following = ownProps.username && follows.includes(ownProps.username)
  const followsYou = ownProps.username && followers.includes(ownProps.username)
  const isTeam = ownProps.isTeam || !!ownProps.teamname

  let onClick = ownProps.onClick
  if (!onClick && ownProps.clickToProfile && ownProps.username) {
    onClick = action('onClickToProfile')
  }

  const style = Styles.collapseStyles([
    ownProps.style,
    onClick && Styles.platformStyles({isElectron: Styles.desktopStyles.clickable}),
  ])
  const url = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)
  const name = isTeam ? ownProps.teamname : ownProps.username
  const iconInfo = followIconHelper(
    ownProps.size,
    !!(ownProps.showFollowingStatus && followsYou),
    !!(ownProps.showFollowingStatus && following)
  )
  return {
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    followIconSize: iconInfo.iconSize,
    followIconStyle: iconInfo.iconStyle,
    followIconType: iconInfo.iconType || undefined,
    isTeam,
    loadingColor: ownProps.loadingColor,
    name: name || '',
    onClick,
    opacity: ownProps.opacity,
    size: ownProps.size,
    style,
    url,
  }
}

export default ConnectedAvatar
export {mockOwnToViewProps}

export function castPlatformStyles(styles: any) {
  return styles
}
