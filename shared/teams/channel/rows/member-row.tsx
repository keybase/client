import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as ChatConstants from '../../../constants/chat2'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import * as UsersGen from '../../../actions/users-gen'
import MenuHeader from '../../team/rows/menu-header.new'

type Props = {
  conversationIDKey: ChatTypes.ConversationIDKey
  firstItem: boolean
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
  const {infoMap, participantInfo, teamMemberInfo, you} = Container.useSelector(s => {
    return {
      infoMap: s.users.infoMap,
      participantInfo: ChatConstants.getParticipantInfo(s, conversationIDKey),
      teamMemberInfo:
        Constants.getTeamDetails(s, teamID)?.members?.get(username) ?? Constants.initialMemberInfo,
      you: s.config.username,
    }
  })
  const fullname = infoMap.get(username)?.fullname ?? participantInfo.contactName.get(username) ?? ''
  const active = teamMemberInfo.status === 'active'
  const roleType = teamMemberInfo.type
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const crown =
    active && roleType && showCrown[roleType] ? (
      <Kb.Icon
        type={('iconfont-crown-' + teamMemberInfo.type) as any}
        style={styles.crownIcon}
        fontSize={10}
      />
    ) : null
  const fullNameLabel =
    fullname && active ? (
      <Kb.Text style={styles.fullNameLabel} type="BodySmall">
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

  const dispatch = Container.useDispatch()
  const channelSelectedMembers = Container.useSelector(state =>
    state.teams.channelSelectedMembers.get(conversationIDKey)
  )
  const anySelected = !!channelSelectedMembers?.size
  const memberSelected = !!channelSelectedMembers?.has(username)

  const onSelect = (selected: boolean) => {
    dispatch(TeamsGen.createChannelSetMemberSelected({conversationIDKey, selected, username: username}))
  }
  const onChat = () =>
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamMember'}))
  const onEditMember = () =>
    username &&
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID, username}, selected: 'teamMember'}]}))
  const onOpenProfile = () => username && dispatch(ProfileGen.createShowUserProfile({username}))
  const onRemoveFromChannel = () => console.log('onRemoveFromChannel not yet implemented')
  const onBlock = () =>
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

  const checkCircle = (
    <Kb.CheckCircle
      checked={memberSelected}
      onCheck={onSelect}
      key={`check-${username}`}
      selectedColor={Styles.isDarkMode() ? Styles.globalColors.black : undefined}
    />
  )

  const body = (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Avatar username={username} size={Styles.isMobile ? 48 : 32} />

      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.nameContainer}>
        <Kb.Box style={Styles.globalStyles.flexBoxRow}>
          <Kb.ConnectedUsernames type="BodySemibold" usernames={[props.username]} />
        </Kb.Box>

        <Kb.Box style={styles.nameContainerInner}>
          {fullNameLabel}
          {crown}
          {!active && (
            <Kb.Text type="BodySmall" style={styles.lockedOutOrDeleted}>
              {teamMemberInfo.status === 'reset' ? 'LOCKED OUT' : 'DELETED'}
            </Kb.Text>
          )}
          <Kb.Text type="BodySmall">
            {!!active && !!teamMemberInfo.type && Constants.typeToLabel[teamMemberInfo.type]}
            {resetLabel}
          </Kb.Text>
        </Kb.Box>
      </Kb.Box2>
    </Kb.Box2>
  )

  const menuHeader = {
    title: 'header',
    view: (
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
    ),
  }

  const menuItems: Kb.MenuItems = [
    'Divider',
    ...(yourOperations.manageMembers
      ? ([
          {icon: 'iconfont-chat', onClick: onChat, title: 'Add to channels...'},
          {icon: 'iconfont-crown-admin', onClick: onEditMember, title: 'Edit role...'},
        ] as Kb.MenuItems)
      : []),
    {icon: 'iconfont-person', onClick: onOpenProfile, title: 'View profile'},
    {icon: 'iconfont-chat', onClick: onChat, title: 'Chat'},
    ...(yourOperations.manageMembers || !isYou ? (['Divider'] as Kb.MenuItems) : []),
    ...(yourOperations.manageMembers || isYou
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
            icon: 'iconfont-block',
            onClick: onBlock,
            title: 'Block',
          },
        ] as Kb.MenuItems)
      : []),
  ]
  const {showingPopup, toggleShowingPopup, popupAnchor, popup} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      header={menuHeader}
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
    />
  ))

  const actions = (
    <Kb.Box2 direction="horizontal" gap="tiny" style={styles.mobileMarginsHack}>
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

  return (
    <Kb.ListItem2
      action={anySelected ? null : actions}
      onlyShowActionOnHover="fade"
      height={Styles.isMobile ? 90 : 64}
      icon={checkCircle}
      iconStyleOverride={styles.checkCircle}
      containerStyleOverride={styles.listItemMargin}
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
  fullNameLabel: {marginRight: Styles.globalMargins.xtiny},
  listItemMargin: {marginLeft: 0},
  lockedOutOrDeleted: {
    ...Styles.globalStyles.fontBold,
    backgroundColor: Styles.globalColors.red,
    color: Styles.globalColors.white,
    marginRight: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xtiny,
    paddingRight: Styles.globalMargins.xtiny,
  },
  mobileMarginsHack: Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
  nameContainer: {...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small},
  nameContainerInner: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
  selected: {backgroundColor: Styles.globalColors.blueLighterOrBlueDarker},
}))

export default ChannelMemberRow
