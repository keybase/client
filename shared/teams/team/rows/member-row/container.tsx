import * as RouterConstants from '../../../../constants/router2'
import * as Constants from '../../../../constants/teams'
import * as UsersConstants from '../../../../constants/users'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ConfigConstants from '../../../../constants/config'
import * as ProfileConstants from '../../../../constants/profile'
import * as TrackerConstants from '../../../../constants/tracker2'
import type * as Types from '../../../../constants/types/teams'
import {TeamMemberRow} from '.'
import * as Container from '../../../../util/container'

type OwnProps = {
  teamID: Types.TeamID
  username: string
  firstItem: boolean
}

const blankInfo = Constants.initialMemberInfo

export default (ownProps: OwnProps) => {
  const {teamID, firstItem, username} = ownProps
  const {members} = Constants.useState(s => s.teamDetails.get(teamID)) ?? Constants.emptyTeamDetails
  const {teamname} = Constants.useState(s => Constants.getTeamMeta(s, teamID))
  const info = members.get(username) || blankInfo

  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const fullName = you ? 'You' : info.fullName
  const needsPUK = info.needsPUK
  const roleType = info.type
  const status = info.status
  const waitingForAdd = Container.useAnyWaiting(Constants.addMemberWaitingKey(teamID, username))
  const waitingForRemove = Container.useAnyWaiting(Constants.removeMemberWaitingKey(teamID, username))
  const youCanManageMembers = Constants.useState(s => Constants.getCanPerform(s, teamname).manageMembers)
  const dispatch = Container.useDispatch()
  const setUserBlocks = UsersConstants.useState(s => s.dispatch.setUserBlocks)
  const onBlock = () => {
    username && setUserBlocks([{setChatBlock: true, setFollowBlock: true, username}])
  }
  const onChat = () => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamMember'}))
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onClick = () => {
    navigateAppend({props: {teamID, username}, selected: 'teamMember'})
  }
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const onOpenProfile = () => {
    username && showUserProfile(username)
  }
  const reAddToTeam = Constants.useState(s => s.dispatch.reAddToTeam)
  const removeMember = Constants.useState(s => s.dispatch.removeMember)
  const onReAddToTeam = () => {
    reAddToTeam(teamID, username)
  }
  const onRemoveFromTeam = () => {
    removeMember(teamID, username)
  }
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onShowTracker = () => {
    if (Container.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }
  const props = {
    firstItem,
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
