import * as Constants from '../../../../../constants/teams'
import * as Chat2Constants from '../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../../../actions/tracker2-gen'
import * as ProfileGen from '../../../../../actions/profile-gen'
import * as Types from '../../../../../constants/types/teams'
import * as RPCTypes from '../../../../../constants/types/rpc-gen'
import {TeamBotRow} from './'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {connect, isMobile} from '../../../../../util/container'
import * as Chat2Types from '../../../../../constants/types/chat2'

type OwnProps = {
  teamID: Types.TeamID
  username: string
}

const blankInfo = Constants.initialMemberInfo

export default connect(
  (state, {teamID, username}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const generalChannel = Chat2Constants.getChannelForTeam(state, teamDetails.teamname, 'general')
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
      _convID: generalChannel.conversationIDKey,
      ownerTeam: bot.ownerTeam || undefined,
      ownerUser: bot.ownerUser || undefined,
      roleType: info.type,
      status: info.status,
      teamname,
      username: info.username,
      youCanManageMembers: Constants.getCanPerform(state, teamname).manageMembers,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    _onEdit: (conversationIDKey: Chat2Types.ConversationIDKey, username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {
                botUsername: username,
                conversationIDKey,
                namespace: 'chat2',
              },
              selected: 'chatInstallBot',
            },
          ],
        })
      ),
    _onRemove: (conversationIDKey: Chat2Types.ConversationIDKey, username: string) =>
      dispatch(Chat2Gen.createRemoveBotMember({conversationIDKey, username})),
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
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    botAlias: stateProps.botAlias,
    description: stateProps.description,
    onClick: dispatchProps.onClick,
    onEdit: () => dispatchProps._onEdit(stateProps._convID, ownProps.username),
    onRemove: () => dispatchProps._onRemove(stateProps._convID, ownProps.username),
    onShowTracker: () => dispatchProps._onShowTracker(ownProps.username),
    ownerTeam: stateProps.ownerTeam,
    ownerUser: stateProps.ownerUser,
    roleType: stateProps.roleType,
    status: stateProps.status,
    username: stateProps.username,
    youCanManageMembers: stateProps.youCanManageMembers,
  })
)(TeamBotRow)
