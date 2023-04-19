import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'
import type * as Types from '../../../../constants/types/teams'
import {typeToLabel} from '../../../../constants/teams'
import type {BoolTypeMap, MemberStatus, TeamRoleType} from '../../../../constants/types/teams'
import MenuHeader from '../menu-header.new'

export type Props = {
  firstItem: boolean
  following: boolean
  fullName: string
  needsPUK: boolean
  onBlock: () => void
  onChat: () => void
  onClick: () => void
  onOpenProfile: () => void
  onReAddToTeam: () => void
  onRemoveFromTeam: () => void
  onShowTracker: () => void
  roleType: TeamRoleType
  status: MemberStatus
  teamID: Types.TeamID
  username: string
  waitingForAdd: boolean
  waitingForRemove: boolean
  you: string
  youCanManageMembers: boolean
}

const showCrown: BoolTypeMap = {
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
  const {roleType, fullName} = props
  const active = props.status === 'active'
  const crown =
    active && roleType && showCrown[roleType] ? (
      <Kb.Icon type={('iconfont-crown-' + roleType) as Kb.IconType} style={styles.crownIcon} fontSize={10} />
    ) : null

  const fullNameLabel =
    fullName && active ? (
      <Kb.Text style={styles.fullNameLabel} type="BodySmall" lineClamp={1}>
        {fullName} •
      </Kb.Text>
    ) : null

  let resetLabel: string | undefined = undefined
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

  const roleLabel = !!active && !!roleType && typeToLabel[roleType]
  const isYou = props.you === props.username
  const teamID = props.teamID

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamSelectedMembers = Container.useSelector(state => state.teams.teamSelectedMembers.get(teamID))
  const anySelected = !!teamSelectedMembers?.size
  const selected = !!teamSelectedMembers?.has(props.username)

  const onSelect = (selected: boolean) => {
    dispatch(TeamsGen.createTeamSetMemberSelected({selected, teamID, username: props.username}))
  }

  const canEnterMemberPage = props.youCanManageMembers && active && !props.needsPUK
  const onClick = anySelected ? () => onSelect(!selected) : canEnterMemberPage ? props.onClick : undefined

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
        <Kb.Box style={Styles.globalStyles.flexBoxRow}>
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
              backgroundColor={Styles.globalColors.red}
              title={props.status === 'reset' ? 'locked out' : 'deleted'}
              style={styles.lockedOutMeta}
            />
          )}
          <Kb.Text type="BodySmall">
            {!!active && !!roleType && typeToLabel[roleType]}
            {resetLabel}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )

  const menuHeader = (
    <MenuHeader
      username={props.username}
      fullName={props.fullName}
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
    ...(props.youCanManageMembers
      ? ([
          {
            icon: 'iconfont-chat',
            onClick: () =>
              dispatch(
                nav.safeNavigateAppendPayload({
                  path: [{props: {teamID, usernames: [props.username]}, selected: 'teamAddToChannels'}],
                })
              ),
            title: 'Add to channels...',
          },
          {icon: 'iconfont-crown-admin', onClick: props.onClick, title: 'Edit role...'},
        ] as Kb.MenuItems)
      : []),
    {icon: 'iconfont-person', onClick: props.onOpenProfile, title: 'View profile'},
    {icon: 'iconfont-chat', onClick: props.onChat, title: 'Chat'},
    ...(props.youCanManageMembers || !isYou ? (['Divider'] as Kb.MenuItems) : []),
    ...(props.youCanManageMembers
      ? ([
          {
            danger: true,
            icon: 'iconfont-remove',
            onClick: props.onRemoveFromTeam,
            title: 'Remove from team',
          },
        ] as Kb.MenuItems)
      : []),
    ...(!isYou
      ? ([
          {
            danger: true,
            icon: 'iconfont-block',
            onClick: props.onBlock,
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
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={props.youCanManageMembers ? styles.mobileMarginsHack : undefined}
    >
      {popup}
      <Kb.Button
        icon="iconfont-chat"
        iconColor={Styles.globalColors.black_50}
        mode="Secondary"
        onClick={props.onChat}
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
      height={Styles.isMobile ? 56 : 48}
      type="Large"
      body={body}
      firstItem={props.firstItem}
      style={selected ? styles.selected : styles.unselected}
      innerStyle={selected ? styles.selected : styles.unselected}
      onClick={onClick}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  checkCircle: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    alignSelf: 'center',
  },
  crownIcon: {marginRight: Styles.globalMargins.xtiny},
  fullNameLabel: {flexShrink: 1, marginRight: Styles.globalMargins.xtiny},
  listItemMargin: {marginLeft: 0},
  lockedOutMeta: {marginRight: Styles.globalMargins.xtiny},
  mobileMarginsHack: Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem2 is malfunctioning because the checkbox width is unusual
  nameContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignSelf: undefined,
    flex: 1,
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.small,
  },
  selected: {backgroundColor: Styles.globalColors.blueLighterOrBlueDarker},
  unselected: {backgroundColor: Styles.globalColors.white},
  widenClickableArea: {margin: -5, padding: 5},
}))
