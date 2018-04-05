// @flow
// A mirror of the remote tracker windows.
// RemoteTrackers renders up to MAX_TRACKERS
// RemoteTracker is a single tracker popup
import * as React from 'react'
import * as Constants from '../constants/tracker'
import {parsePublicAdmins} from '../util/teams'

import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import SyncBrowserWindow from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing} from '../util/container'

const MAX_TRACKERS = 5
const windowOpts = {height: 470, width: 320}

const trackerMapStateToProps = (state: TypedState, {name}) => {
  const _trackerState = state.tracker.userTrackers[name] || state.tracker.nonUserTrackers[name]
  const selectedTeam = _trackerState.selectedTeam
  const showTeam =
    _trackerState.userInfo &&
    _trackerState.userInfo.showcasedTeams &&
    _trackerState.userInfo.showcasedTeams.find(team => team.fqName === selectedTeam)
  const teamname = (showTeam && showTeam.fqName) || ''
  const myUsername = state.config.username
  // If the current user's in the list of public admins, pull them out to the front.
  let publicAdmins = []
  let publicAdminsOthers = 0
  if (showTeam) {
    ;({publicAdmins, publicAdminsOthers} = parsePublicAdmins(showTeam.publicAdmins || [], myUsername))
  }

  return {
    _trackerState,
    description: showTeam && showTeam.description,
    following: state.config.following,
    loggedIn: state.config.loggedIn,
    teamJoinError: state.teams.teamJoinError,
    teamJoinSuccess: state.teams.teamJoinSuccess,
    memberCount: showTeam && showTeam.numMembers,
    openTeam: showTeam && showTeam.open,
    publicAdmins,
    publicAdminsOthers,
    showTeam: showTeam || '',
    teamname,
    youAreInTeam: !!state.teams.getIn(['teamnames', teamname], false),
    youHaveRequestedAccess: !!state.teams.getIn(['teamAccessRequestsPending', teamname], false),
  }
}

const trackerMergeProps = (stateProps, dispatchProps, {name}) => {
  const t = stateProps._trackerState
  const {
    description,
    following,
    loggedIn,
    teamJoinError,
    teamJoinSuccess,
    memberCount,
    openTeam,
    publicAdmins,
    publicAdminsOthers,
    showTeam,
    teamname,
    youAreInTeam,
    youHaveRequestedAccess,
  } = stateProps
  return {
    ...t,
    actionBarReady: !t.serverActive && !t.error,
    description,
    errorMessage: t.error,
    following: following.toObject(),
    loading: Constants.isLoading(t),
    loggedIn,
    memberCount,
    nonUser: t && t.type === 'nonUser',
    openTeam,
    publicAdmins,
    publicAdminsOthers,
    sessionID: name,
    showTeam,
    teamJoinError,
    teamJoinSuccess,
    teamname,
    youAreInTeam,
    youHaveRequestedAccess,
    windowComponent: 'tracker',
    windowOpts,
    windowParam: name,
    windowPositionBottomRight: true,
    windowTitle: `Tracker - ${name}`,
  }
}

// Actions are handled by remote-container
const RemoteTracker = compose(
  connect(trackerMapStateToProps, () => ({}), trackerMergeProps),
  SyncBrowserWindow,
  SyncAvatarProps,
  SyncProps,
  // $FlowIssue gets confused
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
