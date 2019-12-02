// A mirror of the remote tracker windows.
// RemoteTrackers renders up to MAX_TRACKERS
// RemoteTracker is a single tracker popup
import * as React from 'react'
import * as Constants from '../constants/tracker2'
import * as ConfigConstants from '../constants/config'
import * as Styles from '../styles'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import * as Container from '../util/container'
import {serialize} from './remote-serializer.desktop'

type OwnProps = {
  username: string
}

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

const Empty = () => null

// Actions are handled by remote-container
const RemoteTracker2 = Container.compose(
  Container.connect(
    (state, ownProps: OwnProps) => {
      const d = Constants.getDetails(state, ownProps.username)
      return {
        airdropIsLive: state.wallets.airdropDetails.isPromoted,
        assertions: d.assertions,
        bio: d.bio,
        blocked: d.blocked,
        darkMode: Styles.isDarkMode(),
        followThem: Constants.followThem(state, ownProps.username),
        followersCount: d.followersCount,
        followingCount: d.followingCount,
        followsYou: Constants.followsYou(state, ownProps.username),
        fullname: d.fullname,
        guiID: d.guiID,
        hidFromFollowers: d.hidFromFollowers,
        location: d.location,
        loggedIn: state.config.loggedIn,
        reason: d.reason,
        registeredForAirdrop: d.registeredForAirdrop,
        remoteWindowNeedsProps: ConfigConstants.getRemoteWindowPropsCount(
          state.config,
          'tracker2',
          ownProps.username
        ),
        state: d.state,
        teamShowcase: d.teamShowcase,
        waiting: Container.anyWaiting(state, Constants.waitingKey),
        youAreInAirdrop: false,
        yourUsername: state.config.username,
      }
    },
    () => ({}),
    (stateProps, _, ownProps: OwnProps) => {
      return {
        assertions: stateProps.assertions,
        bio: stateProps.bio,
        darkMode: stateProps.darkMode,
        followThem: stateProps.followThem,
        followersCount: stateProps.followersCount,
        followingCount: stateProps.followingCount,
        followsYou: stateProps.followsYou,
        fullname: stateProps.fullname,
        guiID: stateProps.guiID,
        isYou: stateProps.yourUsername === ownProps.username,
        location: stateProps.location,
        reason: stateProps.reason,
        registeredForAirdrop: stateProps.registeredForAirdrop,
        remoteWindowNeedsProps: stateProps.remoteWindowNeedsProps,
        state: stateProps.state,
        teamShowcase: stateProps.teamShowcase,
        username: ownProps.username,
        waiting: stateProps.waiting,
        windowComponent: 'tracker2',
        windowOpts,
        windowParam: ownProps.username,
        windowPositionBottomRight: true,
        windowTitle: `Tracker - ${ownProps.username}`,
        youAreInAirdrop: stateProps.youAreInAirdrop,
      }
    }
  ),
  SyncBrowserWindow,
  SyncAvatarProps,
  // @ts-ignore
  SyncProps(serialize)
)(Empty)

type Props = {
  users: Array<string>
}

class RemoteTracker2s extends React.PureComponent<Props> {
  render() {
    // @ts-ignore
    return this.props.users.map(username => <RemoteTracker2 username={username} key={username} />)
  }
}

export default Container.connect(
  state => ({
    _users: state.tracker2.usernameToDetails,
  }),
  () => ({}),
  (stateProps, _, __) => ({
    users: [...stateProps._users.values()].reduce<Array<string>>((arr, u) => {
      if (arr.length < MAX_TRACKERS) {
        if (u.showTracker) {
          arr.push(u.username)
        }
      }
      return arr
    }, []),
  })
)(RemoteTracker2s)
