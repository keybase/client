import * as Constants from '../../../../constants/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import {TeamMemberRow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {connect, isMobile} from '../../../../util/container'
import {anyWaiting} from '../../../../constants/waiting'

type OwnProps = {
  teamname: string
  username: string
}

const blankInfo = Constants.makeMemberInfo()

const mapStateToProps = (state, {teamname, username}: OwnProps) => {
  const map = Constants.getTeamMembers(state, teamname)
  const info = map.get(username, blankInfo)

  return {
    following: state.config.following.has(username),
    fullName: state.config.username === username ? 'You' : info.fullName,
    roleType: info.type,
    status: info.status,
    username: info.username,
    waitingForAdd: anyWaiting(state, Constants.addMemberWaitingKey(teamname, username)),
    waitingForRemove: anyWaiting(state, Constants.removeMemberWaitingKey(teamname, username)),
    you: state.config.username,
    youCanManageMembers: Constants.getCanPerform(state, teamname).manageMembers,
  }
}

type DispatchProps = {
  _onReAddToTeam: (teamname: string, username: string) => void
  _onRemoveFromTeam: (teamname: string, username: string) => void
  _onShowTracker: (username: string) => void
  onChat: () => void
  onClick: () => void
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps): DispatchProps => ({
  _onReAddToTeam: (teamname: string, username: string) => {
    dispatch(
      TeamsGen.createReAddToTeam({
        teamname,
        username,
      })
    )
  },
  _onRemoveFromTeam: (teamname: string, username: string) => {
    dispatch(TeamsGen.createRemoveMemberOrPendingInvite({email: '', inviteID: '', teamname, username}))
  },
  _onShowTracker: (username: string) => {
    if (isMobile) {
      dispatch(ProfileGen.createShowUserProfile({username}))
    } else {
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    }
  },
  onChat: () => {
    ownProps.username &&
      dispatch(Chat2Gen.createPreviewConversation({participants: [ownProps.username], reason: 'teamMember'}))
  },
  onClick: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: ownProps, selected: 'teamMember'}]})),
})

const mergeProps = (stateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    following: stateProps.following,
    fullName: stateProps.fullName,
    onChat: dispatchProps.onChat,
    onClick: dispatchProps.onClick,
    onReAddToTeam: () => dispatchProps._onReAddToTeam(ownProps.teamname, ownProps.username),
    onRemoveFromTeam: () => dispatchProps._onRemoveFromTeam(ownProps.teamname, ownProps.username),
    onShowTracker: () => dispatchProps._onShowTracker(ownProps.username),
    roleType: stateProps.roleType,
    status: stateProps.status,
    username: stateProps.username,
    waitingForAdd: stateProps.waitingForAdd,
    waitingForRemove: stateProps.waitingForRemove,
    you: stateProps.you,
    youCanManageMembers: stateProps.youCanManageMembers,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TeamMemberRow)
