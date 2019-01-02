// @flow
// A mirror of the remote tracker windows.
// RemoteTrackers renders up to MAX_TRACKERS
// RemoteTracker is a single tracker popup
import * as React from 'react'
import * as Constants from '../../constants/profile2'

import SyncAvatarProps from '../../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../../desktop/remote/sync-browser-window.desktop'
import {connect, compose} from '../../util/container'
import {serialize} from './remote-serializer.desktop'

type OwnProps = {|name: string|}

const MAX_TRACKERS = 5
const windowOpts = {height: 470, width: 320}

const trackerMapStateToProps = (state, {name}) => {
  const d = state.profile2.usernameToDetails.get(name, Constants.noDetails)
  return {
    _assertions: d.assertions,
    bio: d.bio,
    followThem: d.followThem,
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: d.followsYou,
    fullname: d.fullname,
    guiID: d.guiID,
    location: d.location,
    loggedIn: state.config.loggedIn,
    publishedTeams: d.publishedTeams,
    reason: d.reason,
    waiting: state.waiting.counts.get(Constants.waitingKey),
  }
}

const trackerMergeProps = (stateProps, dispatchProps, {name}) => {
  const map = (stateProps._assertions || []).reduce((map, a) => {
    if (!map[a.state]) {
      map[a.state] = 0
    }
    map[a.state]++
    return map
  }, {})

  let state
  if (map.error) {
    state = 'error'
  } else if (map.checking) {
    state = 'checking'
  } else {
    state = 'valid'
  }

  return {
    assertions: stateProps._assertions ? stateProps._assertions.keySeq().toArray() : null,
    bio: stateProps.bio,
    followThem: stateProps.followThem,
    followersCount: stateProps.followersCount,
    followingCount: stateProps.followingCount,
    followsYou: stateProps.followsYou,
    fullname: stateProps.fullname,
    guiID: stateProps.guiID,
    location: stateProps.location,
    onAccept: dispatchProps.onAccept,
    onChat: dispatchProps.onChat,
    onClose: dispatchProps.onClose,
    onFollow: dispatchProps.onFollow,
    onIgnoreFor24Hours: dispatchProps.onIgnoreFor24Hours,
    publishedTeams: stateProps.publishedTeams,
    reason: stateProps.reason,
    state,
    username: name,
    waiting: stateProps.waiting,
    windowComponent: 'profile2',
    windowOpts,
    windowParam: name,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${name}`,
  }
}

const Empty = () => null

// Actions are handled by remote-container
const RemoteProfile2 = compose(
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
class RemoteProfile2s extends React.PureComponent<Props> {
  render() {
    return this.props.users.map(name => <RemoteProfile2 name={name} key={name} />)
  }
}

const mapStateToProps = state => ({
  _users: state.profile2.usernameToDetails,
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
)(RemoteProfile2s)
