// A mirror of the remote tracker windows.
// RemoteTrackers renders up to MAX_TRACKERS
// RemoteTracker is a single tracker popup
import * as React from 'react'
import * as Constants from '../constants/tracker2'

import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, compose} from '../util/container'
import {serialize} from './remote-serializer.desktop'

type OwnProps = {
  username: string
}

const MAX_TRACKERS = 5
const windowOpts = {hasShadow: false, height: 470, transparent: true, width: 320}

const trackerMapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, ownProps.username)
  return {
    airdropIsLive: state.wallets.airdropDetails.isPromoted,
    assertions: d.assertions,
    bio: d.bio,
    followThem: Constants.followThem(state, ownProps.username),
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: Constants.followsYou(state, ownProps.username),
    fullname: d.fullname,
    guiID: d.guiID,
    location: d.location,
    loggedIn: state.config.loggedIn,
    reason: d.reason,
    registeredForAirdrop: d.registeredForAirdrop,
    state: d.state,
    teamShowcase: d.teamShowcase,
    waiting: state.waiting.counts.get(Constants.waitingKey) || 0,
    youAreInAirdrop: false,
    yourUsername: state.config.username,
  }
}

const trackerMergeProps = (stateProps, _, ownProps: OwnProps) => {
  return {
    assertions: stateProps.assertions,
    bio: stateProps.bio,
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
    state: stateProps.state,
    teamShowcase: stateProps.teamShowcase,
    username: ownProps.username,
    waiting: stateProps.waiting,
    windowComponent: 'tracker2',
    windowOpts,
    windowParam: ownProps.username,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${ownProps.username}`,
  }
}

const Empty = () => null

// Actions are handled by remote-container
const RemoteTracker2 = compose(
  connect(
    trackerMapStateToProps,
    () => ({}),
    trackerMergeProps
  ),
  SyncBrowserWindow,
  SyncAvatarProps,
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

const mapStateToProps = state => ({
  _users: state.tracker2.usernameToDetails,
  // TODO
  // _nonUserTrackers: state.tracker.nonUserTrackers,
  // _trackers: state.tracker.userTrackers,
})

const mergeProps = (stateProps, _, __) => ({
  users: stateProps._users
    .filter(d => d.showTracker)
    .map(d => d.username)
    .take(MAX_TRACKERS)
    .toList()
    .toArray(),
})

export default connect(
  mapStateToProps,
  () => ({}),
  mergeProps
)(RemoteTracker2s)
