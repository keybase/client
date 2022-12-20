import * as Constants from '../../../../constants/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as UsersGen from '../../../../actions/users-gen'
import type * as Types from '../../../../constants/types/teams'
import {TeamMemberRow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {connect, isMobile} from '../../../../util/container'
import {anyWaiting} from '../../../../constants/waiting'

type OwnProps = {
  teamID: Types.TeamID
  username: string
  firstItem: boolean
}

const blankInfo = Constants.initialMemberInfo

export default connect(
  (state, {teamID, username}: OwnProps) => {
    const {members} = Constants.getTeamDetails(state, teamID)
    const {teamname} = Constants.getTeamMeta(state, teamID)
    const info = members.get(username) || blankInfo

    return {
      following: state.config.following.has(username),
      fullName: state.config.username === username ? 'You' : info.fullName,
      needsPUK: info.needsPUK,
      roleType: info.type,
      status: info.status,
      teamID,
      teamname,
      username: info.username,
      waitingForAdd: anyWaiting(state, Constants.addMemberWaitingKey(teamID, username)),
      waitingForRemove: anyWaiting(state, Constants.removeMemberWaitingKey(teamID, username)),
      you: state.config.username,
      youCanManageMembers: Constants.getCanPerform(state, teamname).manageMembers,
    }
  },
  (dispatch, {teamID, username}: OwnProps) => ({
    onBlock: () =>
      username &&
      dispatch(
        UsersGen.createSetUserBlocks({
          blocks: [
            {
              setChatBlock: true,
              setFollowBlock: true,
              username,
            },
          ],
        })
      ),
    onChat: () =>
      username &&
      dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamMember'})),
    onClick: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID, username}, selected: 'teamMember'}]})
      ),
    onOpenProfile: () => username && dispatch(ProfileGen.createShowUserProfile({username})),
    onReAddToTeam: () =>
      dispatch(
        TeamsGen.createReAddToTeam({
          teamID,
          username,
        })
      ),
    onRemoveFromTeam: () => dispatch(TeamsGen.createRemoveMember({teamID, username})),
    onShowTracker: () =>
      dispatch(
        isMobile
          ? ProfileGen.createShowUserProfile({username})
          : Tracker2Gen.createShowUser({asTracker: true, username})
      ),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    firstItem: ownProps.firstItem,
    following: stateProps.following,
    fullName: stateProps.fullName,
    needsPUK: stateProps.needsPUK,
    onBlock: dispatchProps.onBlock,
    onChat: dispatchProps.onChat,
    onClick: dispatchProps.onClick,
    onOpenProfile: dispatchProps.onOpenProfile,
    onReAddToTeam: dispatchProps.onReAddToTeam,
    onRemoveFromTeam: dispatchProps.onRemoveFromTeam,
    onShowTracker: dispatchProps.onShowTracker,
    roleType: stateProps.roleType,
    status: stateProps.status,
    teamID: stateProps.teamID,
    username: stateProps.username,
    waitingForAdd: stateProps.waitingForAdd,
    waitingForRemove: stateProps.waitingForRemove,
    you: stateProps.you,
    youCanManageMembers: stateProps.youCanManageMembers,
  })
)(TeamMemberRow)
