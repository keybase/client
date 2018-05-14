// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import Render from './avatar.render'
import {pickBy, debounce} from 'lodash-es'
import {iconTypeToImgSet, urlsToImgSet, type IconType} from './icon'
import {isTesting} from '../local-debug'
import {
  connect,
  type TypedState,
  lifecycle,
  compose,
  setDisplayName,
  withProps,
  withHandlers,
  withStateHandlers,
} from '../util/container'
import {desktopStyles, collapseStyles} from '../styles'
import * as ConfigGen from '../actions/config-gen'
import type {Props, AvatarSize} from './avatar'

export type URLMap = {
  '200': string,
  '360': string,
  '40': string,
}

export type UserPictureSize = 360 | 200 | 40
export type AvatarLookupCallback = (username: string, urlMap: ?URLMap) => void
export type AvatarLookup = (username: string) => ?URLMap
export type AvatarLoad = (username: string, callback: AvatarLookupCallback) => void
export type TeamAvatarLookup = (teamname: string) => ?URLMap
export type TeamAvatarLoad = (teamname: string, callback: AvatarLookupCallback) => void

const avatarPlaceHolders: {[key: string]: IconType} = {
  '112': 'icon-placeholder-avatar-112',
  '12': 'icon-placeholder-avatar-12',
  '16': 'icon-placeholder-avatar-16',
  '176': 'icon-placeholder-avatar-176',
  '24': 'icon-placeholder-avatar-24',
  '32': 'icon-placeholder-avatar-32',
  '40': 'icon-placeholder-avatar-40',
  '48': 'icon-placeholder-avatar-48',
  '64': 'icon-placeholder-avatar-64',
  '80': 'icon-placeholder-avatar-80',
}

const teamPlaceHolders: {[key: string]: IconType} = {
  '112': 'icon-team-placeholder-avatar-112',
  '12': 'icon-team-placeholder-avatar-12',
  '16': 'icon-team-placeholder-avatar-16',
  '176': 'icon-team-placeholder-avatar-176',
  '24': 'icon-team-placeholder-avatar-24',
  '32': 'icon-team-placeholder-avatar-32',
  '40': 'icon-team-placeholder-avatar-40',
  '48': 'icon-team-placeholder-avatar-48',
  '64': 'icon-team-placeholder-avatar-64',
  '80': 'icon-team-placeholder-avatar-80',
}

const followStateToType = {
  '112': {
    theyNo: {youYes: 'icon-following-28'},
    theyYes: {youNo: 'icon-follow-me-28', youYes: 'icon-mutual-follow-28'},
  },
  '176': {
    theyNo: {youYes: 'icon-following-32'},
    theyYes: {youNo: 'icon-follow-me-32', youYes: 'icon-mutual-follow-32'},
  },
  '48': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
  '64': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
  '80': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
}

const followStateToSize = {
  '112': {
    theyNo: {youYes: 28},
    theyYes: {youNo: 28, youYes: 28},
  },
  '176': {
    theyNo: {youYes: 32},
    theyYes: {youNo: 32, youYes: 32},
  },
  '48': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
  '64': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
  '80': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
}

const followSizeToStyle = {
  '112': {bottom: 0, left: 80, position: 'absolute'},
  '176': {bottom: 6, left: 132, position: 'absolute'},
  '48': {bottom: 0, left: 32, position: 'absolute'},
  '64': {bottom: 0, left: 45, position: 'absolute'},
  '80': {bottom: 0, left: 57, position: 'absolute'},
}

const mapStateToProps = (state: TypedState, ownProps: Props) => {
  let _urlMap

  const name = ownProps.username || ownProps.teamname
  if (name) {
    _urlMap = state.config.avatars[name]
  }

  return {
    _urlMap,
  }
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

const _reallyAskForUserData = debounce(() => {
  if (_askDispatch) {
    const usernames = Object.keys(_askQueue)
    _askQueue = {}
    _askDispatch(ConfigGen.createLoadAvatars({usernames}))
  }
}, 100)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _askForTeamUserData: (teamname: string) =>
    dispatch(ConfigGen.createLoadTeamAvatars({teamnames: [teamname]})),
  _askForUserData: (username: string) => _askForUserDataQueueUp(username, dispatch),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isTeam = !!ownProps.teamname

  let style
  if (ownProps.style) {
    if (ownProps.onClick) {
      style = {...ownProps.style, ...desktopStyles.clickable}
    } else {
      style = ownProps.style
    }
  } else if (ownProps.onClick) {
    style = desktopStyles.clickable
  }

  let url
  let isPlaceholder

  if (stateProps._urlMap) {
    url = urlsToImgSet(pickBy(stateProps._urlMap, value => value), ownProps.size)
    isPlaceholder = false
  }

  if (!url) {
    const placeholder = isTeam ? teamPlaceHolders : avatarPlaceHolders
    url = iconTypeToImgSet(placeholder[String(ownProps.size)], ownProps.size)
    isPlaceholder = true
  }

  let _askForUserData = null
  if (isTeam) {
    _askForUserData = () => dispatchProps._askForTeamUserData(ownProps.teamname)
  } else {
    _askForUserData = () => dispatchProps._askForUserData(ownProps.username)
  }

  const _name = isTeam ? ownProps.teamname : ownProps.username

  return {
    _askForUserData,
    _name,
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    followIconSize: _followIconSize(ownProps.size, ownProps.followsYou, ownProps.following),
    followIconStyle: followSizeToStyle[ownProps.size],
    followIconType: _followIconType(ownProps.size, ownProps.followsYou, ownProps.following),
    isPlaceholder,
    isTeam,
    loadingColor: ownProps.loadingColor,
    onClick: ownProps.onClick,
    opacity: ownProps.opacity,
    size: ownProps.size,
    skipBackground: ownProps.skipBackground,
    skipBackgroundAfterLoaded: ownProps.skipBackgroundAfterLoaded,
    style,
    url,
  }
}

export type {AvatarSize}
const realConnector = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('URLAvatar'),
  withStateHandlers(
    {_mounted: false, _stateName: '', _timeoutID: 0},
    {
      setMounted: () => (name: string, timeoutID: number) => ({
        _mounted: true,
        _stateName: name,
        _timeoutID: timeoutID,
      }),
      setUnmounted: () => () => ({_mounted: false, _stateName: '', _timeoutID: 0}),
    }
  ),
  withHandlers({
    _maybeLoadUserData: props => () => {
      // Still looking at the same user?
      if (props._mounted && props._askForUserData) {
        props._askForUserData()
      }
    },
  }),
  // $FlowIssue : todo just have one connector for avatar and pass a flag to include the follow or not
  lifecycle({
    componentDidMount() {
      const _timeoutID = setTimeout(() => {
        if (this.props._name === this.props._stateName) {
          this.props._maybeLoadUserData()
        }
      }, 200)
      this.props.setMounted(this.props._name, _timeoutID)
    },
    componentDidUpdate(prevProps) {
      if (this.props._name !== prevProps._name) {
        this.props._maybeLoadUserData()
      }
    },
    componentWillUnmount() {
      if (this.props._timeoutID) {
        clearTimeout(this.props._timeoutID)
      }
      this.props.setUnmounted()
    },
  })
)

const real = realConnector(Render)

const autoMapStateToProps = (state: TypedState, ownProps: Props) => {
  const me = state.config.username
  if (ownProps.username === me || !me || !ownProps.username) {
    return {}
  }
  // User trackerState (more accurate) if it's available; fall back to state.config if not
  const trackerState = state.tracker.userTrackers[me]
  if (trackerState && trackerState.trackersLoaded) {
    return {
      _followers: trackerState.trackers,
      _following: trackerState.tracking,
    }
  }
  // Need to give these different names because these are sets of strings while the above are arrays of objects
  return {
    _cFollowers: state.config.followers,
    _cFollowing: state.config.following,
  }
}

const autoMergeProps = (stateProps, _, ownProps) => {
  if (stateProps._followers && ownProps.username) {
    const following = stateProps._following.some(user => user.username === ownProps.username)
    const followsYou = stateProps._followers.some(user => user.username === ownProps.username)
    return {
      following,
      followsYou,
      ...ownProps,
    }
  } else if (stateProps._cFollowers && ownProps.username) {
    const following = stateProps._cFollowing.has(ownProps.username || '')
    const followsYou = stateProps._cFollowers.has(ownProps.username || '')
    return {
      following,
      followsYou,
      ...ownProps,
    }
  }
  return ownProps
}

const autoConnector = compose(
  realConnector,
  connect(autoMapStateToProps, () => ({}), autoMergeProps),
  setDisplayName('Avatar')
)
const ConnectedAvatar = autoConnector(Render)

const mockOwnToViewProps = (props: Props) => {
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
    followIconSize: _followIconSize(props.size, !!props.followsYou, !!props.following),
    followIconStyle: followSizeToStyle[props.size],
    followIconType: _followIconType(props.size, !!props.followsYou, !!props.following),
    isPlaceholder: true,
    isTeam,
    loadingColor: props.loadingColor,
    onClick: props.onClick,
    opacity: props.opacity,
    size: props.size,
    style,
    url,
  }
}
const mock = compose(withProps(mockOwnToViewProps))(Render)
console.log('NOJIMA test to just get codecov to run')

export {ConnectedAvatar, mockOwnToViewProps}
export default (isTesting ? mock : real)
