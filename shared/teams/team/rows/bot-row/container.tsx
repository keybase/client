import * as Constants from '../../../../constants/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Types from '../../../../constants/types/teams'
import * as RPCTypes from '../../../../constants/types/rpc-gen'
import {TeamBotRow} from './'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {connect, isMobile} from '../../../../util/container'

type OwnProps = {
  teamID: Types.TeamID
  username: string
}

const blankInfo = Constants.initialMemberInfo

type DispatchProps = {
  _onReAddToTeam: (teamname: string, username: string) => void
  _onRemoveFromTeam: (teamname: string, username: string) => void
  _onShowTracker: (username: string) => void
  onChat: () => void
  onClick: () => void
}

export default connect(
  (state, {teamID, username}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const {members: map = new Map(), teamname} = teamDetails
    const info = map.get(username) || blankInfo
    const bot: RPCTypes.FeaturedBot = state.chat2.featuredBotsMap.get(username) ?? {
      botAlias: info.fullName,
      botUsername: username,
      description: '',
    }

    return {
      roleType: info.type,
      status: info.status,
      teamname,
      username: info.username,
      youCanManageMembers: Constants.getCanPerform(state, teamname).manageMembers,
      ...bot,
    }
  },
  (dispatch, ownProps: OwnProps): DispatchProps => ({
    _onReAddToTeam: (teamID: Types.TeamID, username: string) => {
      dispatch(
        TeamsGen.createReAddToTeam({
          teamID,
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
        dispatch(
          Chat2Gen.createPreviewConversation({participants: [ownProps.username], reason: 'teamMember'})
        )
    },
    onClick: () =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: ownProps, selected: 'teamMember'}]})),
  }),
  (stateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => ({
    botAlias: stateProps.botAlias,
    description: stateProps.description,
    onClick: dispatchProps.onClick,
    onReAddToTeam: () => dispatchProps._onReAddToTeam(ownProps.teamID, ownProps.username),
    onRemoveFromTeam: () => dispatchProps._onRemoveFromTeam(stateProps.teamname, ownProps.username),
    onShowTracker: () => dispatchProps._onShowTracker(ownProps.username),
    ownerTeam: stateProps.ownerTeam,
    ownerUser: stateProps.ownerUser,
    roleType: stateProps.roleType,
    status: stateProps.status,
    username: stateProps.username,
    youCanManageMembers: stateProps.youCanManageMembers,
  })
)(TeamBotRow)
