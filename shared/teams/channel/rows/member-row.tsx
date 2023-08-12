import * as C from '../../../constants'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/teams'
import type * as ChatTypes from '../../../constants/types/chat2'
import * as Constants from '../../../constants/teams'
import * as UsersConstants from '../../../constants/users'
import * as ChatConstants from '../../../constants/chat2'
import MenuHeader from '../../team/rows/menu-header.new'

type Props = {
  conversationIDKey: ChatTypes.ConversationIDKey
  firstItem: boolean
  isGeneral: boolean
  teamID: Types.TeamID
  username: string
}

const showCrown: Types.BoolTypeMap = {
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

const ChannelMemberRow = (props: Props) => {
  const {conversationIDKey, teamID, username} = props
  const infoMap = UsersConstants.useState(s => s.infoMap)
  const participantInfo = ChatConstants.useConvoState(conversationIDKey, s => s.participants)
  const teamMemberInfo = Constants.useState(
    s => s.teamDetails.get(teamID)?.members?.get(username) ?? Constants.initialMemberInfo
  )
  const you = C.useCurrentUserState(s => s.username)
  const fullname = infoMap.get(username)?.fullname ?? participantInfo.contactName.get(username) ?? ''
  const active = teamMemberInfo.status === 'active'
  const roleType = teamMemberInfo.type
  const yourOperations = Constants.useState(s => Constants.getCanPerformByID(s, teamID))
  const crown = React.useMemo(() => {
    return active && roleType && showCrown[roleType] ? (
      <Kb.Icon
        type={('iconfont-crown-' + teamMemberInfo.type) as any}
        style={styles.crownIcon}
        fontSize={10}
      />
    ) : null
  }, [active, roleType, teamMemberInfo.type])
  const fullNameLabel =
    fullname && active ? (
      <Kb.Text style={styles.fullNameLabel} type="BodySmall" lineClamp={1}>
        {fullname} •
      </Kb.Text>
    ) : null
  const resetLabel = !active
    ? teamMemberInfo.status === 'deleted'
      ? 'Has deleted their account'
      : yourOperations.manageMembers
      ? 'Has reset their account'
      : 'Has reset their account; admins can re-invite'
    : null

  const roleLabel = !!active && !!teamMemberInfo.type && Constants.typeToLabel[teamMemberInfo.type]
  const isYou = you === username

  const channelSelectedMembers = Constants.useState(s => s.channelSelectedMembers.get(conversationIDKey))
  const anySelected = !!channelSelectedMembers?.size
  const memberSelected = !!channelSelectedMembers?.has(username)

  const channelSetMemberSelected = Constants.useState(s => s.dispatch.channelSetMemberSelected)

  const onSelect = (selected: boolean) => {
    channelSetMemberSelected(conversationIDKey, username, selected)
  }
  const previewConversation = ChatConstants.useState(s => s.dispatch.previewConversation)
  const onChat = React.useCallback(() => {
    username && previewConversation({participants: [username], reason: 'teamMember'})
  }, [username, previewConversation])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onEditMember = React.useCallback(() => {
    yourOperations.manageMembers &&
      username &&
      navigateAppend({props: {teamID, username}, selected: 'teamMember'})
  }, [yourOperations.manageMembers, username, navigateAppend, teamID])
  const checkCircle = (
    <Kb.CheckCircle
      checked={memberSelected}
      onCheck={onSelect}
      key={`check-${username}`}
      style={styles.widenClickableArea}
    />
  )

  const body = (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
      <Kb.Avatar username={username} size={32} />

      <Kb.Box2 direction="vertical" style={styles.nameContainer}>
        <Kb.Box style={Styles.globalStyles.flexBoxRow}>
          <Kb.ConnectedUsernames type="BodySemibold" usernames={props.username} />
        </Kb.Box>

        <Kb.Box style={styles.nameContainerInner}>
          {fullNameLabel}
          {crown}
          {!active && (
            <Kb.Meta
              backgroundColor={Styles.globalColors.red}
              title={teamMemberInfo.status === 'reset' ? 'locked out' : 'deleted'}
            />
          )}
          <Kb.Text type="BodySmall" style={styles.marginRight}>
            {!!active && !!teamMemberInfo.type && Constants.typeToLabel[teamMemberInfo.type]}
            {resetLabel}
          </Kb.Text>
        </Kb.Box>
      </Kb.Box2>
    </Kb.Box2>
  )

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const setUserBlocks = UsersConstants.useState(s => s.dispatch.setUserBlocks)
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const onOpenProfile = () => username && showUserProfile(username)
      const onRemoveFromChannel = () =>
        navigateAppend({
          props: {conversationIDKey, members: [username], teamID},
          selected: 'teamReallyRemoveChannelMember',
        })
      const onBlock = () => {
        username &&
          setUserBlocks([
            {
              setChatBlock: true,
              setFollowBlock: true,
              username,
            },
          ])
      }

      const menuItems: Kb.MenuItems = [
        'Divider',
        ...(yourOperations.manageMembers
          ? ([
              {
                icon: 'iconfont-chat',
                onClick: () =>
                  navigateAppend({props: {teamID, usernames: [username]}, selected: 'teamAddToChannels'}),
                title: 'Add to channels...',
              },
              {icon: 'iconfont-crown-admin', onClick: onEditMember, title: 'Edit role...'},
            ] as Kb.MenuItems)
          : []),
        {icon: 'iconfont-person', onClick: onOpenProfile, title: 'View profile'},
        {icon: 'iconfont-chat', onClick: onChat, title: 'Chat'},
        ...(yourOperations.manageMembers || !isYou ? (['Divider'] as Kb.MenuItems) : []),
        ...((yourOperations.manageMembers || isYou) && !props.isGeneral
          ? ([
              {
                danger: true,
                icon: 'iconfont-remove',
                onClick: onRemoveFromChannel,
                title: 'Remove from channel',
              },
            ] as Kb.MenuItems)
          : []),
        ...(!isYou
          ? ([
              {
                danger: true,
                icon: 'iconfont-user-block',
                onClick: onBlock,
                title: 'Block',
              },
            ] as Kb.MenuItems)
          : []),
      ]
      const menuHeader = (
        <MenuHeader
          username={username}
          fullName={fullname}
          label={
            <Kb.Box2 direction="horizontal">
              <Kb.Text type="BodySmall">{crown}</Kb.Text>
              <Kb.Text type="BodySmall">{roleLabel}</Kb.Text>
            </Kb.Box2>
          }
        />
      )

      return (
        <Kb.FloatingMenu
          header={menuHeader}
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={toggleShowingPopup}
          visible={true}
        />
      )
    },
    [
      navigateAppend,
      setUserBlocks,
      fullname,
      roleLabel,
      teamID,
      yourOperations,
      username,
      isYou,
      onChat,
      onEditMember,
      props.isGeneral,
      conversationIDKey,
      crown,
      showUserProfile,
    ]
  )

  const {toggleShowingPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  const actions = (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={yourOperations.manageMembers ? styles.mobileMarginsHack : undefined}
    >
      {popup}
      <Kb.Button
        icon="iconfont-chat"
        iconColor={Styles.globalColors.black_50}
        mode="Secondary"
        onClick={onChat}
        small={true}
        tooltip="Open chat"
      />
      <Kb.Button
        icon="iconfont-ellipsis"
        iconColor={Styles.globalColors.black_50}
        mode="Secondary"
        onClick={toggleShowingPopup}
        ref={popupAnchor}
        small={true}
        tooltip="More actions"
      />
    </Kb.Box2>
  )

  const massActionsProps = yourOperations.manageMembers
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
      height={Styles.isMobile ? 64 : 48}
      type="Large"
      body={body}
      firstItem={props.firstItem}
      style={memberSelected ? styles.selected : undefined}
      onClick={anySelected ? () => onSelect(!memberSelected) : onEditMember}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  checkCircle: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    alignSelf: 'center',
  },
  crownIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  fullNameLabel: {flexShrink: 1, marginRight: Styles.globalMargins.xtiny},
  listItemMargin: {marginLeft: 0},
  marginRight: {marginRight: Styles.globalMargins.xtiny},
  mobileMarginsHack: Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
  nameContainer: {flex: 1, marginLeft: Styles.globalMargins.small},
  nameContainerInner: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
  selected: {backgroundColor: Styles.globalColors.blueLighterOrBlueDarker},
  widenClickableArea: {margin: -5, padding: 5},
}))

export default ChannelMemberRow
