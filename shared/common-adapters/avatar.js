// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as React from 'react'
import Render from './avatar.render'
import {debounce} from 'lodash-es'
import {iconTypeToImgSet, urlsToImgSet, type IconType, type Props as IconProps} from './icon'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import {setDisplayName, connect, type TypedState, compose} from '../util/container'
import {
  platformStyles,
  desktopStyles,
  collapseStyles,
  isMobile,
  type StylesCrossPlatformWithSomeDisallowed,
} from '../styles'
import {createShowUserProfile} from '../actions/profile-gen'
import {createGetProfile} from '../actions/tracker-gen'
import * as ConfigGen from '../actions/config-gen'
import flags from '../util/feature-flags'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 16
type URLType = any
type DisallowedStyles = {
  borderStyle?: empty,
}

export type OwnProps = {|
  borderColor?: ?string,
  children?: React.Node,
  clickToProfile?: 'tracker' | 'profile', // If set, go to profile on mobile and tracker/profile on desktop
  editable?: boolean,
  isTeam?: boolean,
  loadingColor?: string,
  onClick?: (e?: SyntheticEvent<Element>) => void,
  onEditAvatarClick?: (e?: SyntheticEvent<Element>) => void,
  opacity?: number,
  size: AvatarSize,
  skipBackground?: boolean,
  skipBackgroundAfterLoaded?: boolean, // if we're on a white background we don't need a white back cover
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  teamname?: ?string,
  username?: ?string,
  showFollowingStatus?: boolean, // show the green dots or not
|}

type PropsWithoutTimer = {|
  askForUserData?: () => void,
  borderColor?: ?string,
  children?: React.Node,
  editable?: boolean,
  followIconSize: number,
  followIconType: ?IconType,
  followIconStyle: ?$PropertyType<IconProps, 'style'>,
  following: boolean,
  followsYou: boolean,
  isTeam: boolean,
  loadingColor?: string,
  name: string,
  onClick?: (e?: SyntheticEvent<Element>) => void,
  onEditAvatarClick?: (e?: SyntheticEvent<Element>) => void,
  opacity?: number,
  size: AvatarSize,
  skipBackground?: boolean,
  skipBackgroundAfterLoaded?: boolean, // if we're on a white background we don't need a white back cover
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  teamname?: ?string,
  url: URLType,
  username?: ?string,
|}

type Props = PropsWithTimer<PropsWithoutTimer>

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

// prettier-ignore
const followStateToType = {
  '128': {theyNo: {youYes: 'icon-following-28'}, theyYes: {youNo: 'icon-follow-me-28', youYes: 'icon-mutual-follow-28'}},
  '48': {theyNo: {youYes: 'icon-following-21'}, theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'}},
  '64': {theyNo: {youYes: 'icon-following-21'}, theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'}},
  '96': {theyNo: {youYes: 'icon-following-21'}, theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'}},
}

const followStateToSize = {
  '128': {theyNo: {youYes: 28}, theyYes: {youNo: 28, youYes: 28}},
  '48': {theyNo: {youYes: 21}, theyYes: {youNo: 21, youYes: 21}},
  '64': {theyNo: {youYes: 21}, theyYes: {youNo: 21, youYes: 21}},
  '96': {theyNo: {youYes: 21}, theyYes: {youNo: 21, youYes: 21}},
}

const followSizeToStyle = {
  '128': {bottom: 0, left: 88, position: 'absolute'},
  '48': {bottom: 0, left: 30, position: 'absolute'},
  '64': {bottom: 0, left: 44, position: 'absolute'},
  '96': {bottom: 0, left: 65, position: 'absolute'},
}

function _followIconType(size: number, followsYou: boolean, following: boolean) {
  const sizeString = String(size)
  if (followStateToType.hasOwnProperty(sizeString)) {
    return followStateToType[sizeString][followsYou ? 'theyYes' : 'theyNo'][following ? 'youYes' : 'youNo']
  }
  return null
}

function _followIconSize(size: number, followsYou: boolean, following: boolean) {
  const sizeString = String(size)
  if (followStateToSize.hasOwnProperty(sizeString)) {
    return followStateToSize[sizeString][followsYou ? 'theyYes' : 'theyNo'][following ? 'youYes' : 'youNo']
  }
  return 0
}

let _askQueue = {}
let _askDispatch = null
// We queue up the actions across all instances of Avatars so we don't flood the system with tons of actions
const _askForUserDataQueueUp = (username: string, dispatch) => {
  _askDispatch = dispatch
  _askQueue[username] = true
  _reallyAskForUserData()
}

const _reallyAskForUserData: () => void = debounce(() => {
  if (_askDispatch) {
    const usernames = Object.keys(_askQueue)
    _askQueue = {}
    _askDispatch(ConfigGen.createLoadAvatars({usernames}))
  }
}, 100)

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const name = ownProps.username || ownProps.teamname
  return {
    _urlMap: name ? state.config.avatars[name] : null,
    following: ownProps.showFollowingStatus ? state.config.following.has(ownProps.username || '') : false,
    followsYou: ownProps.showFollowingStatus ? state.config.followers.has(ownProps.username || '') : false,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _askForTeamUserData: (teamname: string) =>
    dispatch(ConfigGen.createLoadTeamAvatars({teamnames: [teamname]})),
  _askForUserData: (username: string) => _askForUserDataQueueUp(username, dispatch),
  _goToProfile: (username: string, desktopDest: 'profile' | 'tracker') =>
    isMobile || desktopDest === 'profile'
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onClick:
    flags.avatarUploadsEnabled && ownProps.onEditAvatarClick ? ownProps.onEditAvatarClick : ownProps.onClick,
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): PropsWithoutTimer => {
  const isTeam = ownProps.isTeam || !!ownProps.teamname

  let onClick = dispatchProps.onClick
  if (!onClick && ownProps.clickToProfile && ownProps.username) {
    const u = ownProps.username
    const desktopDest = ownProps.clickToProfile
    onClick = () => dispatchProps._goToProfile(u, desktopDest)
  }

  const style = collapseStyles([
    ownProps.style,
    onClick && platformStyles({isElectron: desktopStyles.clickable}),
  ])

  let url = stateProps._urlMap ? urlsToImgSet(stateProps._urlMap, ownProps.size) : null
  if (!url) {
    url = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)
  }

  const askForUserData = isTeam
    ? () => {
        ownProps.teamname && dispatchProps._askForTeamUserData(ownProps.teamname)
      }
    : () => {
        ownProps.username && dispatchProps._askForUserData(ownProps.username)
      }

  const name = isTeam ? ownProps.teamname : ownProps.username

  return {
    askForUserData,
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    editable: ownProps.editable,
    followIconSize: _followIconSize(ownProps.size, stateProps.followsYou, stateProps.following),
    followIconStyle: followSizeToStyle[ownProps.size] || null,
    followIconType: _followIconType(ownProps.size, stateProps.followsYou, stateProps.following),
    following: stateProps.following,
    followsYou: stateProps.followsYou,
    isTeam,
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

class AvatarConnector extends React.PureComponent<Props> {
  _mounted: boolean = false

  componentDidMount() {
    this._mounted = true
    this.props.setTimeout(this._maybeLoadUserData, 200)
  }
  componentDidUpdate(prevProps: Props) {
    if (this.props.name !== prevProps.name) {
      this._maybeLoadUserData()
    }
  }
  componentWillUnmount() {
    this._mounted = false
  }

  _maybeLoadUserData = () => {
    // Still looking at the same user?
    if (this._mounted && this.props.askForUserData) {
      this.props.askForUserData()
    }
  }
  render() {
    return (
      <Render
        skipBackground={this.props.skipBackground}
        borderColor={this.props.borderColor}
        children={this.props.children}
        editable={flags.avatarUploadsEnabled && this.props.editable}
        followIconSize={this.props.followIconSize}
        followIconStyle={this.props.followIconStyle}
        followIconType={this.props.followIconType}
        isTeam={this.props.isTeam}
        loadingColor={this.props.loadingColor}
        onClick={this.props.onClick}
        onEditAvatarClick={this.props.onEditAvatarClick}
        opacity={this.props.opacity}
        size={this.props.size}
        style={this.props.style}
        url={this.props.url}
      />
    )
  }
}

const Avatar = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Avatar'),
  HOCTimers
)(AvatarConnector)

const mockOwnToViewProps = (
  ownProps: OwnProps,
  follows: string[],
  followers: string[],
  action: string => (...args: any[]) => void
): Props => {
  const following = follows.includes(ownProps.username)
  const followsYou = followers.includes(ownProps.username)
  const isTeam = ownProps.isTeam || !!ownProps.teamname

  let onClick = ownProps.onClick
  if (!onClick && ownProps.clickToProfile && ownProps.username) {
    onClick = action('onClickToProfile')
  }

  const style = collapseStyles([
    ownProps.style,
    onClick && platformStyles({isElectron: desktopStyles.clickable}),
  ])
  const url = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, ownProps.size)

  const name = isTeam ? ownProps.teamname : ownProps.username

  const setInterval = action('setInterval')
  const setTimeout = action('setTimeout')

  return {
    clearInterval: action('clearInterval'),
    clearTimeout: action('clearTimeout'),
    setInterval: (...args) => {
      setInterval(...args)
      return (0: any)
    },
    setTimeout: (...args) => {
      setTimeout(...args)
      return (0: any)
    },

    borderColor: ownProps.borderColor,
    children: ownProps.children,
    followIconSize: _followIconSize(ownProps.size, followsYou, following),
    followIconStyle: followSizeToStyle[ownProps.size],
    followIconType: _followIconType(ownProps.size, followsYou, following),
    following,
    followsYou,
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

export default Avatar
export {mockOwnToViewProps}

export function castPlatformStyles(styles: any) {
  return styles
}
