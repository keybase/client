import * as C from '@/constants'
import * as Teams from '@/constants/teams'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useChannelSelectionState} from '../common/selection-state'
import RoleCrown from '../common/role-crown'
import {
  FullNameLabel,
  getMassActionsProps,
  getResetLabel,
  MemberActions,
  selectionStyles,
  useOnBlockUser,
} from '../team/rows/common'
import {useUsersState} from '@/stores/users'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'
import {useLoadedTeam} from '../team/use-loaded-team'
import {getRolePickerDisabledReasons} from '../role-picker-utils'

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  firstItem: boolean
  isGeneral: boolean
  participantInfo: T.Chat.ParticipantInfo
  teamID: T.Teams.TeamID
  username: string
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

const ChannelMemberRow = (props: Props) => {
  const {conversationIDKey, participantInfo, teamID, username} = props
  const userFullname = useUsersState(s => s.infoMap.get(username)?.fullname)
  const {selectedMembers: channelSelectedMembers, setMemberSelected: channelSetMemberSelected} =
    useChannelSelectionState()
  const {teamDetails, teamMeta, yourOperations} = useLoadedTeam(teamID)
  const teamMemberInfo = teamDetails.members.get(username) ?? Teams.initialMemberInfo
  const you = useCurrentUserState(s => s.username)
  const fullname = userFullname ?? participantInfo.contactName.get(username) ?? ''
  const active = teamMemberInfo.status === 'active'
  const roleType = teamMemberInfo.type
  const disabledReasons = getRolePickerDisabledReasons({
    canManageMembers: yourOperations.manageMembers,
    currentUsername: you,
    members: teamDetails.members,
    membersToModify: username,
    teamname: teamMeta.teamname,
  })
  const hasEditableRoleChoice = Teams.teamRoleTypes.some(
    role => role !== roleType && disabledReasons[role] === undefined
  )
  const canEditRole =
    yourOperations.manageMembers && active && !teamMemberInfo.needsPUK && hasEditableRoleChoice
  const crown = active ? <RoleCrown role={roleType} fontSize={10} /> : null
  const resetLabel = !active ? getResetLabel(teamMemberInfo.status, yourOperations.manageMembers) : null

  const roleLabel = !!active && Teams.typeToLabel[teamMemberInfo.type]
  const isYou = you === username

  const anySelected = !!channelSelectedMembers.size
  const memberSelected = channelSelectedMembers.has(username)

  const onSelect = (selected: boolean) => {
    channelSetMemberSelected(username, selected)
  }
  const previewConversation = C.Router2.previewConversation
  const onChat = () => {
    if (username) {
      previewConversation({participants: [username], reason: 'teamMember'})
    }
  }
  const navigateAppend = C.Router2.navigateAppend
  const onEditMember = () => {
    if (yourOperations.manageMembers && username) {
      navigateAppend({name: 'teamMember', params: {teamID, username}})
    }
  }
  const onBlock = useOnBlockUser(username)

  const body = (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
      <Kb.Avatar username={username} size={32} />

      <Kb.Box2 direction="vertical" flex={1} style={selectionStyles.nameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.ConnectedUsernames type="BodySemibold" usernames={props.username} />
        </Kb.Box2>

        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="xtiny">
          <FullNameLabel fullName={fullname} active={active} />
          {crown}
          {!active && (
            <Kb.Meta
              backgroundColor={Kb.Styles.globalColors.red}
              title={teamMemberInfo.status === 'reset' ? 'locked out' : 'deleted'}
            />
          )}
          <Kb.Text type="BodySmall" style={styles.marginRight}>
            {!!active && Teams.typeToLabel[teamMemberInfo.type]}
            {resetLabel}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )

  const actions = (
    <MemberActions
      blockIcon="iconfont-user-block"
      canEditRole={canEditRole}
      crown={crown}
      fullName={fullname}
      isYou={isYou}
      onAddToChannels={() =>
        navigateAppend({name: 'teamAddToChannels', params: {teamID, usernames: [username]}})
      }
      onBlock={onBlock}
      onChat={onChat}
      onEditRole={onEditMember}
      onOpenProfile={() => username && navToProfile(username)}
      removeItem={
        (yourOperations.manageMembers || isYou) && !props.isGeneral
          ? {
              onClick: () =>
                navigateAppend({
                  name: 'teamReallyRemoveChannelMember',
                  params: {conversationIDKey, members: [username], teamID},
                }),
              title: 'Remove from channel',
            }
          : undefined
      }
      roleLabel={roleLabel}
      username={username}
      youCanManageMembers={yourOperations.manageMembers}
    />
  )

  const massActionsProps = yourOperations.manageMembers
    ? getMassActionsProps(username, memberSelected, onSelect)
    : {}
  return (
    <Kb.ListItem
      {...massActionsProps}
      action={anySelected ? null : actions}
      onlyShowActionOnHover="fade"
      height={isMobile ? 64 : 48}
      type="Large"
      body={body}
      firstItem={props.firstItem}
      style={memberSelected ? selectionStyles.selected : undefined}
      onClick={anySelected ? () => onSelect(!memberSelected) : onEditMember}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      marginRight: {marginRight: Kb.Styles.globalMargins.xtiny},
    }) as const
)

export default ChannelMemberRow
