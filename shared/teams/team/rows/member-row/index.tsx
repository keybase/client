import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/teams'
import flags from '../../../../util/feature-flags'
import * as Container from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'
import {typeToLabel} from '../../../../constants/teams'
import {isLargeScreen} from '../../../../constants/platform'
import {BoolTypeMap, MemberStatus, TeamRoleType} from '../../../../constants/types/teams'
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
  let crown, fullNameLabel, resetLabel
  const active = props.status === 'active'
  if (active && props.roleType && showCrown[props.roleType]) {
    crown = (
      <Kb.Icon type={('iconfont-crown-' + props.roleType) as any} style={styles.crownIcon} fontSize={10} />
    )
  }
  if (props.fullName && active) {
    fullNameLabel = (
      <Kb.Text style={styles.fullNameLabel} type="BodySmall" lineClamp={1}>
        {props.fullName} •
      </Kb.Text>
    )
  }
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

  const roleLabel = !!active && !!props.roleType && typeToLabel[props.roleType]
  const isYou = props.you === props.username

  if (flags.teamsRedesign) {
    const teamID = props.teamID

    const dispatch = Container.useDispatch()
    const nav = Container.useSafeNavigation()
    const teamSelectedMembers = Container.useSelector(state => state.teams.teamSelectedMembers.get(teamID))
    const anySelected = !!teamSelectedMembers?.size
    const selected = !!teamSelectedMembers?.has(props.username)

    const onSelect = (selected: boolean) => {
      dispatch(TeamsGen.createTeamSetMemberSelected({selected, teamID, username: props.username}))
    }

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
            <Kb.ConnectedUsernames type="BodyBold" usernames={props.username} colorFollowing={true} />
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
              {!!active && !!props.roleType && typeToLabel[props.roleType]}
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

    const canEnterMemberPage = props.youCanManageMembers && active && !props.needsPUK
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
        onClick={anySelected ? () => onSelect(!selected) : canEnterMemberPage ? props.onClick : undefined}
      />
    )
  }

  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, !active && styles.containerReset])}>
      <Kb.Box style={styles.innerContainerTop}>
        <Kb.ClickableBox
          style={styles.clickable}
          onClick={active ? props.onClick : props.status === 'deleted' ? undefined : props.onShowTracker}
        >
          <Kb.Avatar username={props.username} size={Styles.isMobile ? 48 : 32} />
          <Kb.Box style={styles.nameContainer}>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>
              <Kb.ConnectedUsernames type="BodyBold" usernames={props.username} />
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
                {roleLabel}
                {resetLabel}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box>
        </Kb.ClickableBox>
        {!active && !Styles.isMobile && props.youCanManageMembers && (
          <Kb.Box style={styles.buttonBarContainer}>
            <Kb.ButtonBar>
              <Kb.Button
                small={true}
                label="Remove"
                onClick={props.onRemoveFromTeam}
                type="Dim"
                waiting={props.waitingForRemove}
                disabled={props.waitingForAdd}
              />
            </Kb.ButtonBar>
          </Kb.Box>
        )}
        <Kb.Box style={styles.chatIconContainer}>
          {(active || isLargeScreen) && (
            // Desktop & mobile large screen - display on the far right of the first row
            // Also when user is active
            <Kb.Icon
              onClick={props.onChat}
              style={
                Styles.isMobile
                  ? Styles.collapseStyles([styles.chatButtonMobile, styles.chatButtonMobileSmallTop])
                  : styles.chatButtonDesktop
              }
              fontSize={Styles.isMobile ? 20 : 16}
              type="iconfont-chat"
            />
          )}
        </Kb.Box>
      </Kb.Box>
      {!active && Styles.isMobile && props.youCanManageMembers && (
        <Kb.Box style={styles.innerContainerBottom}>
          <Kb.ButtonBar direction="row">
            {props.status !== 'deleted' && (
              <Kb.Button
                small={true}
                label="Re-Admit"
                onClick={props.onReAddToTeam}
                type="Success"
                waiting={props.waitingForAdd}
                disabled={props.waitingForRemove}
              />
            )}
            <Kb.Button
              small={true}
              label="Remove"
              onClick={props.onRemoveFromTeam}
              type="Dim"
              waiting={props.waitingForRemove}
              disabled={props.waitingForAdd}
            />
          </Kb.ButtonBar>
          {!isLargeScreen && (
            // Mobile small screens - for inactive user
            // display next to reset / deleted controls
            <Kb.Icon
              onClick={props.onChat}
              style={Styles.collapseStyles([
                styles.chatButtonMobile,
                active && styles.chatButtonMobileSmallTop,
              ])}
              fontSize={20}
              type="iconfont-chat"
            />
          )}
        </Kb.Box>
      )}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  buttonBarContainer: {...Styles.globalStyles.flexBoxRow, flexShrink: 1},
  chatButtonDesktop: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.tiny,
    padding: Styles.globalMargins.tiny,
  },
  chatButtonMobile: {
    position: 'absolute',
    right: 16,
    top: 24,
  },
  chatButtonMobileSmallTop: {
    top: 12,
  },
  chatIconContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 1,
    height: '100%',
  },
  checkCircle: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    alignSelf: 'center',
  },
  clickable: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexGrow: 1,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  containerReset: {
    backgroundColor: Styles.globalColors.blueLighter2,
  },
  crownIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  fullNameLabel: {flexShrink: 1, marginRight: Styles.globalMargins.xtiny},
  innerContainerBottom: {...Styles.globalStyles.flexBoxRow, flexShrink: 1},
  innerContainerTop: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
    alignItems: 'center',
    flexShrink: 0,
    height: Styles.isMobile ? 56 : 48,
    width: '100%',
  },
  listItemMargin: {marginLeft: 0},
  lockedOutMeta: {
    marginRight: Styles.globalMargins.xtiny,
  },
  menuButton: {
    marginLeft: Styles.globalMargins.xtiny,
  },
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
