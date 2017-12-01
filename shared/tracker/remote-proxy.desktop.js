// @flow
// A mirror of the remote tracker windows.
// RemoteTrackers renders up to MAX_TRACKERS
// RemoteTrackere is a single tracker popup
// import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../constants/tracker'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing} from '../util/container'

const MAX_TRACKERS = 5
const windowOpts = {height: 470, width: 320}

const trackerMapStateToProps = (state: TypedState, {name}) => {
  return {
    _trackerState: state.tracker.userTrackers[name] || state.tracker.nonUserTrackers[name],
    loggedIn: state.config.loggedIn,
    myUsername: state.config.username,
  }
}

const trackerMergeProps = (stateProps, dispatchProps, {name}) => {
  const t = stateProps._trackerState
  return {
    ...t,
    actionBarReady: !t.serverActive && !t.error,
    component: 'tracker',
    errorMessage: t.error,
    loading: Constants.isLoading(t),
    loggedIn: stateProps.loggedIn,
    myUsername: stateProps.myUsername,
    nonUser: t && t.type === 'nonUser',
    positionBottomRight: true,
    selectorParams: name,
    sessionID: name,
    title: `Tracker - ${name}`,
    windowOpts,
    windowTitle: '',
  }
}

// Actions are handled by remote-container
const RemoteTracker = compose(
  connect(trackerMapStateToProps, () => ({}), trackerMergeProps),
  SyncBrowserWindow,
  SyncAvatarProps,
  SyncProps,
  renderNothing
)(null)

type Props = {
  names: Array<string>,
}
class RemoteTrackers extends React.PureComponent<Props> {
  render() {
    return this.props.names.map(name => <RemoteTracker name={name} key={name} />)
  }
}

const mapStateToProps = (state: TypedState) => ({
  _nonUserTrackers: state.tracker.nonUserTrackers,
  _trackers: state.tracker.userTrackers,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  names: [
    ...Object.keys(stateProps._trackers).filter(
      t => !stateProps._trackers[t].closed && !stateProps._trackers[t].hidden
    ),
    ...Object.keys(stateProps._nonUserTrackers).filter(
      n => !stateProps._nonUserTrackers[n].closed && !stateProps._nonUserTrackers[n].hidden
    ),
  ].slice(0, MAX_TRACKERS),
})

export default connect(mapStateToProps, () => ({}), mergeProps)(RemoteTrackers)
