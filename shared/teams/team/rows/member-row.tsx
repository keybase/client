import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import type * as T from '@/constants/types'
import MenuHeader from './menu-header.new'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useTrackerState} from '@/stores/tracker2'
import {useProfileState} from '@/stores/profile'
import {useUsersState} from '@/stores/users'
import {useCurrentUserState} from '@/stores/current-user'

export type Props = {
  firstItem: boolean
  fullName: string
  needsPUK: boolean
  onBlock: () => void
  onChat: () => void
  onClick: () => void
  onOpenProfile: () => void
  onReAddToTeam: () => void
  onRemoveFromTeam: () => void
  onShowTracker: () => void
  roleType: T.Teams.TeamRoleType
  status: T.Teams.MemberStatus
  teamID: T.Teams.TeamID
  username: string
  waitingForAdd: boolean
  waitingForRemove: boolean
  you: string
  youCanManageMembers: boolean
}

const showCrown: T.Teams.BoolTypeMap = {
  admin: true,
  bot: false,
  owner: true,
  reader: false,
  restrictedbot: false,
  writer: false,
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamMemberRow = (props: Props) => {
  const {roleType, fullName, username, youCanManageMembers} = props
  const {onOpenProfile, onChat, onBlock, onRemoveFromTeam} = props
  const active = props.status === 'active'
  const crown = React.useMemo(
    () =>
      active && showCrown[roleType] ? (
        <Kb.Icon
          type={('iconfont-crown-' + roleType) as Kb.IconType}
          style={styles.crownIcon}
          fontSize={10}
        />
      ) : null,
    [active, roleType]
  )

  const fullNameLabel =
    fullName && active ? (
      <Kb.Text style={styles.fullNameLabel} type="BodySmall" lineClamp={1}>
        {fullName} •
      </Kb.Text>
    ) : null

  let resetLabel: string | undefined
  if (!active) {
    resetLabel = props.youCanManageMembers
      ? 'Has reset their account'
      : 'Has reset their account; admins can re-invite'
    if (props.status === 'deleted') {
      resetLabel = 'Has deleted their account'
    }
  } else if (props.needsPUK) {
    resetLabel = ' • Needs to update Keybase'
  }

  const roleLabel = !!active && Teams.typeToLabel[roleType]
  const isYou = props.you === props.username
  const teamID = props.teamID

  const nav = useSafeNavigation()
  const teamSelectedMembers = Teams.useTeamsState(s => s.teamSelectedMembers.get(teamID))
  const anySelected = !!teamSelectedMembers?.size
  const selected = !!teamSelectedMembers?.has(props.username)

  const setMemberSelected = Teams.useTeamsState(s => s.dispatch.setMemberSelected)

  const onSelect = React.useCallback(
    (selected: boolean) => {
      setMemberSelected(teamID, props.username, selected)
    },
    [setMemberSelected, teamID, props.username]
  )

  const canEnterMemberPage = props.youCanManageMembers && active && !props.needsPUK
  const pOnClick = props.onClick
  const onClick = React.useMemo(
    () => (anySelected ? () => onSelect(!selected) : canEnterMemberPage ? pOnClick : undefined),
    [anySelected, pOnClick, canEnterMemberPage, onSelect, selected]
  )

  const checkCircle = (
    <Kb.CheckCircle
      checked={selected}
      onCheck={onSelect}
      key={`check-${props.username}`}
      style={styles.widenClickableArea}
    />
  )

  const body = (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
      <Kb.Avatar username={props.username} size={32} />
      <Kb.Box2 direction="vertical" style={styles.nameContainer}>
        <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>
          <Kb.ConnectedUsernames
            type="BodyBold"
            usernames={props.username}
            colorFollowing={true}
            onUsernameClicked={onClick}
          />
        </Kb.Box>

        <Kb.Box2 direction="horizontal" centerChildren={true} alignSelf="flex-start">
          {fullNameLabel}
          {crown}
          {!active && (
            <Kb.Meta
              backgroundColor={Kb.Styles.globalColors.red}
              title={props.status === 'reset' ? 'locked out' : 'deleted'}
              style={styles.lockedOutMeta}
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

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      const menuHeader = (
        <MenuHeader
          username={username}
          fullName={fullName}
          label={
            <Kb.Box2 direction="horizontal">
              <Kb.Text type="BodySmall">{crown}</Kb.Text>
              <Kb.Text type="BodySmall">{roleLabel}</Kb.Text>
            </Kb.Box2>
          }
        />
      )

      const menuItems: Kb.MenuItems = [
        'Divider',
        ...(youCanManageMembers
          ? ([
              {
                icon: 'iconfont-chat',
                onClick: () =>
                  nav.safeNavigateAppend({
                    props: {teamID, usernames: [username]},
                    selected: 'teamAddToChannels',
                  }),
                title: 'Add to channels...',
              },
              {icon: 'iconfont-crown-admin', onClick: onClick, title: 'Edit role...'},
            ] as Kb.MenuItems)
          : []),
        {icon: 'iconfont-person', onClick: onOpenProfile, title: 'View profile'},
        {icon: 'iconfont-chat', onClick: onChat, title: 'Chat'},
        ...(youCanManageMembers || !isYou ? (['Divider'] as Kb.MenuItems) : []),
        ...(youCanManageMembers
          ? ([
              {
                danger: true,
                icon: 'iconfont-remove',
                onClick: onRemoveFromTeam,
                title: 'Remove from team',
              },
            ] as Kb.MenuItems)
          : []),
        ...(!isYou
          ? ([
              {
                danger: true,
                icon: 'iconfont-block',
                onClick: onBlock,
                title: 'Block',
              },
            ] as Kb.MenuItems)
          : []),
      ]
      return (
        <Kb.FloatingMenu
          header={menuHeader}
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={hidePopup}
          visible={true}
        />
      )
    },
    [
      crown,
      fullName,
      roleLabel,
      nav,
      teamID,
      username,
      youCanManageMembers,
      isYou,
      onBlock,
      onChat,
      onOpenProfile,
      onRemoveFromTeam,
      onClick,
    ]
  )
  const {showPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  const actions = (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={props.youCanManageMembers ? styles.mobileMarginsHack : undefined}
    >
      {popup}
      <Kb.Button
        icon="iconfont-chat"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={props.onChat}
        small={true}
        tooltip="Open chat"
      />
      <Kb.Button
        icon="iconfont-ellipsis"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={showPopup}
        ref={popupAnchor}
        small={true}
        tooltip="More actions"
      />
    </Kb.Box2>
  )

  const massActionsProps = props.youCanManageMembers
    ? {
        containerStyleOverride: styles.listItemMargin,
        icon: checkCircle,
        iconStyleOverride: styles.checkCircle,
      }
    : {}

  return (
    <Kb.ListItem2
      {...massActionsProps}
      action={anySelected ? null : actions}
      onlyShowActionOnHover="fade"
      height={Kb.Styles.isMobile ? 56 : 48}
      type="Large"
      body={body}
      firstItem={props.firstItem}
      style={selected ? styles.selected : styles.unselected}
      innerStyle={selected ? styles.selected : styles.unselected}
      onClick={onClick}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkCircle: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
    alignSelf: 'center',
  },
  crownIcon: {marginRight: Kb.Styles.globalMargins.xtiny},
  fullNameLabel: {flexShrink: 1, marginRight: Kb.Styles.globalMargins.xtiny},
  listItemMargin: {marginLeft: 0},
  lockedOutMeta: {marginRight: Kb.Styles.globalMargins.xtiny},
  mobileMarginsHack: Kb.Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
  nameContainer: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignSelf: undefined,
    flex: 1,
    justifyContent: 'center',
    marginLeft: Kb.Styles.globalMargins.small,
  },
  selected: {backgroundColor: Kb.Styles.globalColors.blueLighterOrBlueDarker},
  unselected: {backgroundColor: Kb.Styles.globalColors.white},
  widenClickableArea: {margin: -5, padding: 5},
}))

type OwnProps = {
  teamID: T.Teams.TeamID
  username: string
  firstItem: boolean
}

const blankInfo = Teams.initialMemberInfo

const Container = (ownProps: OwnProps) => {
  const {teamID, firstItem, username} = ownProps
  const {members, reAddToTeam, removeMember, youCanManageMembers} = Teams.useTeamsState(
    C.useShallow(s => {
      const details = s.teamDetails.get(teamID) ?? Teams.emptyTeamDetails
      const {members} = details
      const m = Teams.getTeamMeta(s, teamID)
      const {teamname} = m
      const youCanManageMembers = Teams.getCanPerform(s, teamname).manageMembers
      const {dispatch} = s
      const {removeMember, reAddToTeam} = dispatch
      return {members, reAddToTeam, removeMember, youCanManageMembers}
    })
  )
  const info = members.get(username) || blankInfo

  const you = useCurrentUserState(s => s.username)
  const fullName = you === username ? 'You' : info.fullName
  const needsPUK = info.needsPUK
  const roleType = info.type
  const status = info.status
  const waitingForAdd = C.Waiting.useAnyWaiting(C.waitingKeyTeamsAddMember(teamID, username))
  const waitingForRemove = C.Waiting.useAnyWaiting(C.waitingKeyTeamsRemoveMember(teamID, username))
  const setUserBlocks = useUsersState(s => s.dispatch.setUserBlocks)
  const onBlock = () => {
    username && setUserBlocks([{setChatBlock: true, setFollowBlock: true, username}])
  }
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => {
    username && previewConversation({participants: [username], reason: 'teamMember'})
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = () => {
    navigateAppend({props: {teamID, username}, selected: 'teamMember'})
  }
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const onOpenProfile = () => {
    username && showUserProfile(username)
  }
  const onReAddToTeam = () => {
    reAddToTeam(teamID, username)
  }
  const onRemoveFromTeam = () => {
    removeMember(teamID, username)
  }
  const showUser = useTrackerState(s => s.dispatch.showUser)
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
