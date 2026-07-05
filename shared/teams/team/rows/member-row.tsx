import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Teams from '@/constants/teams'
import type * as T from '@/constants/types'
import RoleCrown from '../../common/role-crown'
import {
  FullNameLabel,
  getMassActionsProps,
  getResetLabel,
  MemberActions,
  selectionStyles,
  useOnBlockUser,
} from './common'
import {useTeamSelectionState} from '../../common/selection-state'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'
import {useLoadedTeam} from '../use-loaded-team'
import {removeMember} from '@/teams/actions'
import {getRolePickerDisabledReasons} from '@/teams/role-picker-utils'

export type Props = {
  firstItem: boolean
  fullName: string
  needsPUK: boolean
  onBlock: () => void
  onChat: () => void
  onClick: () => void
  onOpenProfile: () => void
  onRemoveFromTeam: () => void
  roleType: T.Teams.TeamRoleType
  status: T.Teams.MemberStatus
  teamID: T.Teams.TeamID
  username: string
  you: string
  youCanEditRole: boolean
  youCanManageMembers: boolean
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamMemberRow = (props: Props) => {
  const {roleType, fullName, username, youCanEditRole, youCanManageMembers} = props
  const {onOpenProfile, onChat, onBlock, onRemoveFromTeam} = props
  const active = props.status === 'active'
  const crown = active ? <RoleCrown role={roleType} fontSize={10} /> : null

  let resetLabel: string | undefined
  if (!active) {
    resetLabel = getResetLabel(props.status, youCanManageMembers)
  } else if (props.needsPUK) {
    resetLabel = ' • Needs to update Keybase'
  }

  const isYou = props.you === props.username
  const teamID = props.teamID

  const nav = useSafeNavigation()
  const {selectedMembers: teamSelectedMembers, setMemberSelected} = useTeamSelectionState()
  const anySelected = !!teamSelectedMembers.size
  const selected = teamSelectedMembers.has(props.username)

  const onSelect = (selected: boolean) => {
    setMemberSelected(props.username, selected)
  }

  const canEnterMemberPage = props.youCanManageMembers && active && !props.needsPUK
  const onClick = anySelected ? () => onSelect(!selected) : canEnterMemberPage ? props.onClick : undefined

  const body = (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
      <Kb.Avatar username={props.username} size={32} />
      <Kb.Box2 direction="vertical" flex={1} style={selectionStyles.nameContainer} justifyContent="center">
        <Kb.ConnectedUsernames
          type="BodyBold"
          usernames={props.username}
          colorFollowing={true}
          onUsernameClicked={onClick}
        />
        <Kb.Box2 direction="horizontal" centerChildren={true} alignSelf="flex-start" gap="xtiny">
          <FullNameLabel fullName={fullName} active={active} />
          {crown}
          {!active && (
            <Kb.Meta
              backgroundColor={Kb.Styles.globalColors.red}
              title={props.status === 'reset' ? 'locked out' : 'deleted'}
            />
          )}
          <Kb.Text type="BodySmall">
            {!!active && Teams.typeToLabel[roleType]}
            {resetLabel}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )

  const actions = (
    <MemberActions
      blockIcon="iconfont-block"
      canEditRole={youCanEditRole}
      crown={crown}
      fullName={fullName}
      isYou={isYou}
      onAddToChannels={() =>
        nav.safeNavigateAppend({
          name: 'teamAddToChannels',
          params: {teamID, usernames: [username]},
        })
      }
      onBlock={onBlock}
      onChat={onChat}
      onEditRole={props.onClick}
      onOpenProfile={onOpenProfile}
      removeItem={
        youCanManageMembers ? {onClick: onRemoveFromTeam, title: 'Remove from team'} : undefined
      }
      roleLabel={!!active && Teams.typeToLabel[roleType]}
      username={username}
      youCanManageMembers={youCanManageMembers}
    />
  )

  const massActionsProps = props.youCanManageMembers
    ? getMassActionsProps(props.username, selected, onSelect)
    : {}

  return (
    <Kb.ListItem
      {...massActionsProps}
      action={anySelected ? null : actions}
      onlyShowActionOnHover="fade"
      height={isMobile ? 56 : 48}
      type="Large"
      body={body}
      firstItem={props.firstItem}
      style={selected ? selectionStyles.selected : selectionStyles.unselected}
      innerStyle={selected ? selectionStyles.selected : selectionStyles.unselected}
      onClick={onClick}
    />
  )
}

type OwnProps = {
  teamID: T.Teams.TeamID
  username: string
  firstItem: boolean
}

const blankInfo = Teams.initialMemberInfo

const MemberRow = (ownProps: OwnProps) => {
  const {teamID, firstItem, username} = ownProps
  const {teamDetails, teamMeta, yourOperations} = useLoadedTeam(teamID)
  const members = teamDetails.members
  const youCanManageMembers = yourOperations.manageMembers
  const info = members.get(username) || blankInfo

  const you = useCurrentUserState(s => s.username)
  const fullName = you === username ? 'You' : info.fullName
  const needsPUK = info.needsPUK
  const roleType = info.type
  const status = info.status
  const disabledReasons = getRolePickerDisabledReasons({
    canManageMembers: youCanManageMembers,
    currentUsername: you,
    members,
    membersToModify: username,
    teamname: teamMeta.teamname,
  })
  const hasEditableRoleChoice = Teams.teamRoleTypes.some(
    role => role !== roleType && disabledReasons[role] === undefined
  )
  const youCanEditRole = youCanManageMembers && status === 'active' && !needsPUK && hasEditableRoleChoice
  const onBlock = useOnBlockUser(username)
  const onChat = () => {
    if (username) {
      C.Router2.previewConversation({participants: [username], reason: 'teamMember'})
    }
  }
  const onClick = () => {
    C.Router2.navigateAppend({name: 'teamMember', params: {teamID, username}})
  }
  const onOpenProfile = () => {
    if (username) {
      navToProfile(username)
    }
  }
  return (
    <TeamMemberRow
      firstItem={firstItem}
      fullName={fullName}
      needsPUK={needsPUK}
      onBlock={onBlock}
      onChat={onChat}
      onClick={onClick}
      onOpenProfile={onOpenProfile}
      onRemoveFromTeam={() => removeMember(teamID, username)}
      roleType={roleType}
      status={status}
      teamID={teamID}
      username={username}
      you={you}
      youCanEditRole={youCanEditRole}
      youCanManageMembers={youCanManageMembers}
    />
  )
}

export default MemberRow
