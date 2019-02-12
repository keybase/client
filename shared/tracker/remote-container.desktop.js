// @flow
// Inside tracker we use an embedded Avatar which is connected. This assumes its connected and uses immutable stuff.
// We convert the over-the-wire plain json to immutable in the remote-store helper
import * as ConfigGen from '../actions/config-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as TrackerGen from '../actions/tracker-gen'
import Tracker from './index.desktop'
import {branch, remoteConnect, compose, lifecycle, renderNothing, withStateHandlers} from '../util/container'

type OwnProps = any //
type State = any // this type is HUGE and annoying. lets not port it over

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch, {teamname}) => ({
  _checkRequestedAccess: (teamname: string) => dispatch(TeamsGen.createCheckRequestedAccess({teamname})),
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  _onChat: (username: string) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  },
  _onClickAvatar: (username: string) => {
    dispatch(ProfileGen.createOnClickAvatar({openWebsite: false, username}))
    // Make sure the main app window is showing
    dispatch(ConfigGen.createShowMain())
  },
  _onClose: (username: string) => dispatch(TrackerGen.createOnClose({username})),
  _onFollow: (username: string) => dispatch(TrackerGen.createFollow({username})),
  _onIgnore: (username: string) => dispatch(TrackerGen.createIgnore({username})),
  _onRefollow: (username: string) => dispatch(TrackerGen.createRefollow({username})),
  _onRetry: (username: string) => dispatch(TrackerGen.createGetProfile({ignoreCache: true, username})),
  _onSetTeamJoinError: (error: string) => dispatch(TeamsGen.createSetTeamJoinError({error})),
  _onSetTeamJoinSuccess: (success: boolean) =>
    dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname: ''})),
  _onUnfollow: (username: string) => dispatch(TrackerGen.createUnfollow({username})),
  _onUpdateSelectedTeam: (selectedTeam: string, username: string) =>
    dispatch(TrackerGen.createUpdateSelectedTeam({selectedTeam, username})),
  _onUserClick: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onChat: () => dispatchProps._onChat(stateProps.username),
  onClickAvatar: () => dispatchProps._onClickAvatar(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.username),
  onFollow: () => dispatchProps._onFollow(stateProps.username),
  onIgnore: () => dispatchProps._onIgnore(stateProps.username),
  onRefollow: () => dispatchProps._onRefollow(stateProps.username),
  onRetry: stateProps.errorMessage ? () => dispatchProps._onRetry(stateProps.username) : null,
  onUnfollow: () => dispatchProps._onUnfollow(stateProps.username),
  onUpdateSelectedTeam: (selectedTeam: string) =>
    dispatchProps._onUpdateSelectedTeam(selectedTeam, stateProps.username),
  onUserClick: (username: string) => dispatchProps._onUserClick(username),
})

export default compose(
  withStateHandlers<any, any, any>(
    {selectedTeamRect: null},
    {onSetSelectedTeamRect: () => selectedTeamRect => ({selectedTeamRect})}
  ),
  remoteConnect<OwnProps, State, _, _, _, _>(s => s, mapDispatchToProps, mergeProps),
  branch(props => !props.nonUser && !props.username, renderNothing),
  lifecycle({
    componentDidMount() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      this.props._loadTeams()
    },
  })
)(Tracker)
