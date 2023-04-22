import * as Constants from '../../../../constants/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as UsersGen from '../../../../actions/users-gen'
import type * as Types from '../../../../constants/types/teams'
import {TeamMemberRow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import {anyWaiting} from '../../../../constants/waiting'

type OwnProps = {
  teamID: Types.TeamID
  username: string
  firstItem: boolean
}

const blankInfo = Constants.initialMemberInfo

export default (ownProps: OwnProps) => {
  const {teamID, firstItem} = ownProps
  const {members} = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const {teamname} = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const info = members.get(ownProps.username) || blankInfo

  const following = Container.useSelector(state => state.config.following.has(username))
  const fullName = Container.useSelector(state =>
    state.config.username === username ? 'You' : info.fullName
  )
  const needsPUK = info.needsPUK
  const roleType = info.type
  const status = info.status
  const username = info.username
  const waitingForAdd = Container.useSelector(state =>
    anyWaiting(state, Constants.addMemberWaitingKey(teamID, username))
  )
  const waitingForRemove = Container.useSelector(state =>
    anyWaiting(state, Constants.removeMemberWaitingKey(teamID, username))
  )
  const you = Container.useSelector(state => state.config.username)
  const youCanManageMembers = Container.useSelector(
    state => Constants.getCanPerform(state, teamname).manageMembers
  )
  const dispatch = Container.useDispatch()
  const onBlock = () => {
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
      )
  }
  const onChat = () => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamMember'}))
  }
  const onClick = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID, username}, selected: 'teamMember'}]}))
  }
  const onOpenProfile = () => {
    username && dispatch(ProfileGen.createShowUserProfile({username}))
  }
  const onReAddToTeam = () => {
    dispatch(
      TeamsGen.createReAddToTeam({
        teamID,
        username,
      })
    )
  }
  const onRemoveFromTeam = () => {
    dispatch(TeamsGen.createRemoveMember({teamID, username}))
  }
  const onShowTracker = () => {
    if (Container.isMobile) {
      dispatch(ProfileGen.createShowUserProfile({username}))
    } else {
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    }
  }
  const props = {
    firstItem,
    following: following,
    fullName: fullName,
    needsPUK: needsPUK,
    onBlock: onBlock,
    onChat: onChat,
    onClick: onClick,
    onOpenProfile: onOpenProfile,
    onReAddToTeam: onReAddToTeam,
    onRemoveFromTeam: onRemoveFromTeam,
    onShowTracker: onShowTracker,
    roleType: roleType,
    status: status,
    teamID: teamID,
    username: username,
    waitingForAdd: waitingForAdd,
    waitingForRemove: waitingForRemove,
    you: you,
    youCanManageMembers: youCanManageMembers,
  }
  return <TeamMemberRow {...props} />
}
