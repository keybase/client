import * as C from '@/constants'
import type * as T from '@/constants/types'
import {TeamMemberRow} from '.'

type OwnProps = {
  teamID: T.Teams.TeamID
  username: string
  firstItem: boolean
}

const blankInfo = C.Teams.initialMemberInfo

const Container = (ownProps: OwnProps) => {
  const {teamID, firstItem, username} = ownProps
  const {members} = C.useTeamsState(s => s.teamDetails.get(teamID)) ?? C.Teams.emptyTeamDetails
  const {teamname} = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const info = members.get(username) || blankInfo

  const you = C.useCurrentUserState(s => s.username)
  const fullName = you === username ? 'You' : info.fullName
  const needsPUK = info.needsPUK
  const roleType = info.type
  const status = info.status
  const waitingForAdd = C.Waiting.useAnyWaiting(C.Teams.addMemberWaitingKey(teamID, username))
  const waitingForRemove = C.Waiting.useAnyWaiting(C.Teams.removeMemberWaitingKey(teamID, username))
  const youCanManageMembers = C.useTeamsState(s => C.Teams.getCanPerform(s, teamname).manageMembers)
  const setUserBlocks = C.useUsersState(s => s.dispatch.setUserBlocks)
  const onBlock = () => {
    username && setUserBlocks([{setChatBlock: true, setFollowBlock: true, username}])
  }
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => {
    username && previewConversation({participants: [username], reason: 'teamMember'})
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = () => {
    navigateAppend({props: {teamID, username}, selected: 'teamMember'})
  }
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onOpenProfile = () => {
    username && showUserProfile(username)
  }
  const reAddToTeam = C.useTeamsState(s => s.dispatch.reAddToTeam)
  const removeMember = C.useTeamsState(s => s.dispatch.removeMember)
  const onReAddToTeam = () => {
    reAddToTeam(teamID, username)
  }
  const onRemoveFromTeam = () => {
    removeMember(teamID, username)
  }
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onShowTracker = () => {
    if (C.isMobile) {
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

export default Container
