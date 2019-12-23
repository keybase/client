import * as Constants from '../../../../constants/teams'
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
  _onShowTracker: (username: string) => void
  onChat: () => void
  onClick: () => void
}

export default connect(
  (state, {teamID, username}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const {members: map = new Map<string, Types.MemberInfo>(), teamname} = teamDetails
    const info: Types.MemberInfo = map.get(username) || blankInfo
    const bot: RPCTypes.FeaturedBot = state.chat2.featuredBotsMap.get(username) ?? {
      botAlias: info.fullName,
      botUsername: username,
      description: '',
      extendedDescription: '',
      isPromoted: false,
      rank: 0,
    }

    return {
      ...bot,
      ownerTeam: bot.ownerTeam || undefined,
      ownerUser: bot.ownerUser || undefined,
      roleType: info.type,
      status: info.status,
      teamname,
      username: info.username,
      youCanManageMembers: Constants.getCanPerform(state, teamname).manageMembers,
    }
  },
  (dispatch, ownProps: OwnProps): DispatchProps => ({
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
    onShowTracker: () => dispatchProps._onShowTracker(ownProps.username),
    ownerTeam: stateProps.ownerTeam,
    ownerUser: stateProps.ownerUser,
    roleType: stateProps.roleType,
    status: stateProps.status,
    username: stateProps.username,
    youCanManageMembers: stateProps.youCanManageMembers,
  })
)(TeamBotRow)
