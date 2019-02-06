// @flow
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

type OwnProps = {|username: string|}

const MAX_TRACKERS = 5
const windowOpts = {height: 470, width: 320}

const trackerMapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, ownProps.username)
  return {
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
    state: d.state,
    teamShowcase: d.teamShowcase,
    waiting: state.waiting.counts.get(Constants.waitingKey) || 0,
    yourUsername: state.config.username,
  }
}

const trackerMergeProps = (stateProps, dispatchProps, ownProps) => {
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
  connect<OwnProps, _, _, _, _>(
    trackerMapStateToProps,
    () => ({}),
    trackerMergeProps
  ),
  SyncBrowserWindow,
  SyncAvatarProps,
  SyncProps(serialize)
)(Empty)

type Props = {
  users: Array<string>,
}
class RemoteTracker2s extends React.PureComponent<Props> {
  render() {
    return this.props.users.map(username => <RemoteTracker2 username={username} key={username} />)
  }
}

const mapStateToProps = state => ({
  _users: state.tracker2.usernameToDetails,
  // TODO
  // _nonUserTrackers: state.tracker.nonUserTrackers,
  // _trackers: state.tracker.userTrackers,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  users: stateProps._users
    .filter(d => d.showTracker)
    .map(d => d.username)
    .take(MAX_TRACKERS)
    .toList()
    .toArray(),
})

export default connect<{||}, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps
)(RemoteTracker2s)
