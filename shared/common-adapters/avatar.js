// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as React from 'react'
import Render from './avatar.render'
import {pickBy, debounce} from 'lodash-es'
import {iconTypeToImgSet, urlsToImgSet, type IconType, type Props as IconProps} from './icon'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import {setDisplayName, connect, type TypedState, compose} from '../util/container'
import {
  platformStyles,
  desktopStyles,
  collapseStyles,
  type StylesCrossPlatformWithSomeDisallowed,
} from '../styles'
import * as ConfigGen from '../actions/config-gen'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 16
type URLType = any
type DisallowedStyles = {
  borderStyle?: empty,
}

export type OwnProps = {
  borderColor?: string,
  children?: React.Node,
  loadingColor?: string,
  onClick?: () => void,
  opacity?: number,
  size: AvatarSize,
  skipBackground?: boolean,
  skipBackgroundAfterLoaded?: boolean, // if we're on a white background we don't need a white back cover
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  teamname?: ?string,
  username?: ?string,
}

type Props = PropsWithTimer<{
  askForUserData?: () => void,
  borderColor?: string,
  children?: React.Node,
  followIconSize: number,
  followIconType: ?IconType,
  followIconStyle: ?$PropertyType<IconProps, 'style'>,
  following: boolean,
  followsYou: boolean,
  isTeam: boolean,
  loadingColor?: string,
  name: string,
  onClick?: () => void,
  opacity?: number,
  size: AvatarSize,
  skipBackground?: boolean,
  skipBackgroundAfterLoaded?: boolean, // if we're on a white background we don't need a white back cover
  style?: StylesCrossPlatformWithSomeDisallowed<DisallowedStyles>,
  teamname?: ?string,
  url: URLType,
  username?: ?string,
}>

const avatarPlaceHolders: {[key: string]: IconType} = {
  '128': 'icon-placeholder-avatar-112',
  '16': 'icon-placeholder-avatar-16',
  '32': 'icon-placeholder-avatar-32',
  '48': 'icon-placeholder-avatar-48',
  '64': 'icon-placeholder-avatar-64',
  '96': 'icon-placeholder-avatar-80',
}

const teamPlaceHolders: {[key: string]: IconType} = {
  '128': 'icon-team-placeholder-avatar-112',
  '16': 'icon-team-placeholder-avatar-16',
  '32': 'icon-team-placeholder-avatar-32',
  '48': 'icon-team-placeholder-avatar-48',
  '64': 'icon-team-placeholder-avatar-64',
  '96': 'icon-team-placeholder-avatar-80',
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
  '128': {bottom: 0, left: 80, position: 'absolute'},
  '48': {bottom: 0, left: 32, position: 'absolute'},
  '64': {bottom: 0, left: 45, position: 'absolute'},
  '96': {bottom: 0, left: 57, position: 'absolute'},
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
const _askForUserDataQueueUp = (username: string, dispatch: Dispatch) => {
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
    _urlMap: name ? state.config.avatars[name] : undefined,
    following: state.config.following.has(ownProps.username || ''),
    followsYou: state.config.followers.has(ownProps.username || ''),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _askForTeamUserData: (teamname: string) =>
    dispatch(ConfigGen.createLoadTeamAvatars({teamnames: [teamname]})),
  _askForUserData: (username: string) => _askForUserDataQueueUp(username, dispatch),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const isTeam = !!ownProps.teamname

  let style
  if (ownProps.style) {
    if (ownProps.onClick) {
      style = collapseStyles([ownProps.style, platformStyles({isElectron: desktopStyles.clickable})])
    } else {
      style = ownProps.style
    }
  } else if (ownProps.onClick) {
    style = platformStyles({isElectron: desktopStyles.clickable})
  }

  let url
  if (stateProps._urlMap) {
    url = urlsToImgSet(pickBy(stateProps._urlMap, value => value), ownProps.size)
  }

  if (!url) {
    const placeholder = isTeam ? teamPlaceHolders : avatarPlaceHolders
    url = iconTypeToImgSet(placeholder[String(ownProps.size)], ownProps.size)
  }

  let askForUserData = null
  if (isTeam) {
    const teamname = ownProps.teamname
    askForUserData = teamname ? () => dispatchProps._askForTeamUserData(teamname) : undefined
  } else {
    const username = ownProps.username
    askForUserData = username ? () => dispatchProps._askForUserData(username) : undefined
  }

  const name = isTeam ? ownProps.teamname : ownProps.username

  return {
    askForUserData,
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    followIconSize: _followIconSize(ownProps.size, stateProps.followsYou, stateProps.following),
    followIconStyle: followSizeToStyle[ownProps.size] || null,
    followIconType: _followIconType(ownProps.size, stateProps.followsYou, stateProps.following),
    following: stateProps.following,
    followsYou: stateProps.followsYou,
    isTeam,
    loadingColor: ownProps.loadingColor,
    name,
    onClick: ownProps.onClick,
    opacity: ownProps.opacity,
    size: ownProps.size,
    skipBackground: ownProps.skipBackground,
    skipBackgroundAfterLoaded: ownProps.skipBackgroundAfterLoaded,
    style,
    url,
  }
}

class AvatarConnector extends React.PureComponent<Props> {
  _mounted: boolean = true

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
        followIconSize={this.props.followIconSize}
        followIconStyle={this.props.followIconStyle}
        followIconType={this.props.followIconType}
        isTeam={this.props.isTeam}
        loadingColor={this.props.loadingColor}
        onClick={this.props.onClick}
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

const mockOwnToViewProps = (props: OwnProps, following: boolean, followsYou: boolean) => {
  const isTeam = !!props.teamname
  const placeholder = isTeam ? teamPlaceHolders : avatarPlaceHolders
  const url = iconTypeToImgSet(placeholder[String(props.size)], props.size)

  let style
  if (props.style) {
    if (props.onClick) {
      style = collapseStyles([props.style, desktopStyles.clickable])
    } else {
      style = props.style
    }
  } else if (props.onClick) {
    style = desktopStyles.clickable
  }

  return {
    borderColor: props.borderColor,
    children: props.children,
    followIconSize: _followIconSize(props.size, followsYou, following),
    followIconStyle: followSizeToStyle[props.size],
    followIconType: _followIconType(props.size, followsYou, following),
    isTeam,
    loadingColor: props.loadingColor,
    onClick: props.onClick,
    opacity: props.opacity,
    size: props.size,
    style,
    url,
  }
}

export default Avatar
export {mockOwnToViewProps}
