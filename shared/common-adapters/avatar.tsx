// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as React from 'react'
import Avatar from './avatar.render'
import {throttle} from 'lodash-es'
import {iconTypeToImgSet, urlsToImgSet, IconType, IconStyle} from './icon'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as ConfigGen from '../actions/config-gen'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16
type URLType = any

type DisallowedStyles = {
  borderStyle?: never
}

export type OwnProps = {
  borderColor?: string | null
  children?: React.ReactNode
  clickToProfile?: 'tracker' | 'profile' // If set, go to profile on mobile and tracker/profile on desktop,,,
  editable?: boolean
  isTeam?: boolean
  loadingColor?: string
  onClick?: (e?: React.SyntheticEvent) => void
  onEditAvatarClick?: (e?: React.SyntheticEvent) => void | null
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean // if we're on a white background we don't need a white back cover,,,
  style?: Styles.StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  teamname?: string | null
  username?: string | null
  showFollowingStatus?: boolean // show the green dots or not
}

type Props = {
  askForUserData?: () => void
  borderColor?: string | null
  children?: React.ReactNode
  editable?: boolean
  followIconSize: number
  followIconType: IconType | null
  followIconStyle: IconStyle
  isTeam: boolean
  load: () => void
  loadingColor?: string
  name: string
  onClick?: (e?: React.SyntheticEvent) => void
  onEditAvatarClick?: (e?: React.SyntheticEvent) => void | null
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean // if we're on a white background we don't need a white back cover,,,
  style?: Styles.StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>
  teamname?: string | null
  url: URLType
  username?: string | null
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
  const iconType: IconType | null = rel ? `icon-${rel}-${iconSize}` : null
  return {
    iconSize,
    iconStyle: followSizeToStyle[size],
    iconType,
  }
}

// We keep one timer for all instances to reduce timer overhead
class SharedAskForUserData {
  _cacheTime = 1000 * 60 * 30 // cache for 30 mins
  _dispatch: (arg0: any) => void
  _teamQueue = {}
  _teamLastReq = {}
  _userQueue = {}
  _userLastReq = {}
  _username = ''

  // call this with the current username
  _checkLoggedIn = username => {
    if (username !== this._username) {
      console.log('clearing cache due to username change')
      this._username = username
      this._teamLastReq = {}
      this._userLastReq = {}
    }
  }
  _makeCalls = throttle(
    () => {
      if (!this._dispatch) {
        return
      }
      const now = Date.now()
      const oldEnough = now - this._cacheTime
      const usernames = Object.keys(this._userQueue).filter(k => {
        const lr = this._userLastReq[k]
        if (!lr || lr < oldEnough) {
          this._userLastReq[k] = now
          return true
        }
        return false
      })
      const teamnames = Object.keys(this._teamQueue).filter(k => {
        const lr = this._teamLastReq[k]
        if (!lr || lr < oldEnough) {
          this._teamLastReq[k] = now
          return true
        }
        return false
      })
      this._teamQueue = {}
      this._userQueue = {}
      if (usernames.length || teamnames.length) {
        requestAnimationFrame(() => {
          usernames.length && this._dispatch(ConfigGen.createLoadAvatars({usernames}))
          teamnames.length && this._dispatch(ConfigGen.createLoadTeamAvatars({teamnames}))
        })
      }
    },
    100,
    {leading: false}
  )
  getTeam = name => {
    this._teamQueue[name] = true
    this._makeCalls()
  }
  getUser = name => {
    this._userQueue[name] = true
    this._makeCalls()
  }
  injectDispatch = dispatch => (this._dispatch = dispatch)
}
const _sharedAskForUserData = new SharedAskForUserData()

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const name = ownProps.username || ownProps.teamname
  _sharedAskForUserData._checkLoggedIn(state.config.username)
  return {
    _following: ownProps.showFollowingStatus ? state.config.following.has(ownProps.username || '') : false,
    _followsYou: ownProps.showFollowingStatus ? state.config.followers.has(ownProps.username || '') : false,
    _urlMap: name ? state.config.avatars.get(name) : null,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
  _sharedAskForUserData.injectDispatch(dispatch)
  return {
    _goToProfile: (username: string, desktopDest: 'profile' | 'tracker') =>
      Styles.isMobile || desktopDest === 'profile'
        ? dispatch(ProfileGen.createShowUserProfile({username}))
        : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
    onClick: ownProps.onEditAvatarClick ? ownProps.onEditAvatarClick : ownProps.onClick,
  }
}

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

    const style = Styles.isMobile
      ? ownProps.style
      : Styles.collapseStyles([
          ownProps.style,
          onClick && Styles.platformStyles({isElectron: Styles.desktopStyles.clickable}),
        ])

    let url = stateProps._urlMap ? urlsToImgSet(stateProps._urlMap.toObject(), ownProps.size) : null
    let load
    if (!url) {
      url = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)
      load = isTeam
        ? () => {
            ownProps.teamname && _sharedAskForUserData.getTeam(ownProps.teamname)
          }
        : () => {
            ownProps.username && _sharedAskForUserData.getUser(ownProps.username)
          }
    }

    const name = isTeam ? ownProps.teamname : ownProps.username
    const iconInfo = followIconHelper(ownProps.size, stateProps._followsYou, stateProps._following)

    return {
      borderColor: ownProps.borderColor,
      children: ownProps.children,
      editable: ownProps.editable,
      followIconSize: iconInfo.iconSize,
      followIconStyle: iconInfo.iconStyle,
      followIconType: iconInfo.iconType,
      isTeam,
      load,
      loadingColor: ownProps.loadingColor,
      name: name || '',
      onClick,
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
  const following = follows.includes(ownProps.username)
  const followsYou = followers.includes(ownProps.username)
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
    followIconType: iconInfo.iconType,
    isTeam,
    load: () => {},
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
