// @flow
import * as AppGen from '../actions/app-gen'
import * as ChatGen from '../actions/chat-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as TeamsGen from '../actions/teams-gen'
import * as TrackerGen from '../actions/tracker-gen'
import Tracker from './index.desktop'
import {
  branch,
  connect,
  compose,
  lifecycle,
  renderNothing,
  withStateHandlers,
  type Dispatch,
} from '../util/container'

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = (dispatch: Dispatch, {teamname}) => ({
  _checkRequestedAccess: (teamname: string) => dispatch(TeamsGen.createCheckRequestedAccess({teamname})),
  _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  _onChat: (username: string, myUsername: string) => {
    dispatch(AppGen.createShowMain())
    dispatch(ChatGen.createStartConversation({users: [username, myUsername]}))
  },
  _onClickAvatar: (username: string) =>
    dispatch(ProfileGen.createOnClickAvatar({openWebsite: true, username})),
  _onClose: (username: string) => dispatch(TrackerGen.createOnClose({username})),
  _onFollow: (username: string) => dispatch(TrackerGen.createFollow({username})),
  _onIgnore: (username: string) => dispatch(TrackerGen.createIgnore({username})),
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  _onRefollow: (username: string) => dispatch(TrackerGen.createRefollow({username})),
  _onRetry: (username: string) => dispatch(TrackerGen.createGetProfile({ignoreCache: true, username})),
  _onSetTeamJoinError: (error: string) => dispatch(TeamsGen.createSetTeamJoinError({error})),
  _onSetTeamJoinSuccess: (success: boolean) =>
    dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname: null})),
  _onUnfollow: (username: string) => dispatch(TrackerGen.createUnfollow({username})),
  _onUserClick: (username: string) =>
    dispatch(TrackerGen.createGetProfile({username, ignoreCache: true, forceDisplay: true})),
  _onUpdateSelectedTeam: (selectedTeam: string, username: string) =>
    dispatch(TrackerGen.createUpdateSelectedTeam({selectedTeam, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onChat: () => dispatchProps._onChat(stateProps.username, stateProps.myUsername),
  onClickAvatar: () => dispatchProps._onClickAvatar(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.username),
  onFollow: () => dispatchProps._onFollow(stateProps.username),
  onIgnore: () => dispatchProps._onIgnore(stateProps.username),
  onRefollow: () => dispatchProps._onRefollow(stateProps.username),
  onRetry: stateProps.errorMessage ? () => dispatchProps._onRetry(stateProps.username) : null,
  onUnfollow: () => dispatchProps._onUnfollow(stateProps.username),
  onUserClick: (username: string) => dispatchProps._onUserClick(username),
  onUpdateSelectedTeam: (selectedTeam: string) =>
    dispatchProps._onUpdateSelectedTeam(selectedTeam, stateProps.username),
})
export default compose(
  withStateHandlers(
    {selectedTeamRect: null},
    {onSetSelectedTeamRect: () => selectedTeamRect => ({selectedTeamRect})}
  ),
  connect(state => state, mapDispatchToProps, mergeProps),
  branch(props => !props.username, renderNothing),
  lifecycle({
    componentWillMount: function() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      this.props._loadTeams()
    },
  })
)(Tracker)
