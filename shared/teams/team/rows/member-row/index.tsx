import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {typeToLabel} from '../../../../constants/teams'
import {isLargeScreen} from '../../../../constants/platform'
import {BoolTypeMap, MemberStatus, TeamRoleType} from '../../../../constants/types/teams'
import flags from '../../../../util/feature-flags'
import MenuHeader from '../menu-header.new'

export type Props = {
  following: boolean
  fullName: string
  onBlock: () => void
  onChat: () => void
  onClick: () => void
  onOpenProfile: () => void
  onReAddToTeam: () => void
  onRemoveFromTeam: () => void
  onShowTracker: () => void
  roleType: TeamRoleType
  status: MemberStatus
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
      <Kb.Text style={styles.fullNameLabel} type="BodySmall">
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
  }

  const roleLabel = !!active && !!props.roleType && typeToLabel[props.roleType]
  const isYou = props.you === props.username

  const {showingPopup, setShowingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      header={{
        title: 'header',
        view: (
          <MenuHeader
            username={props.username}
            fullName={props.fullName}
            label={
              <Kb.Box2 direction="horizontal">
                {crown}
                {roleLabel}
              </Kb.Box2>
            }
          />
        ),
      }}
      items={[
        'Divider',
        ...(props.youCanManageMembers
          ? ([
              {icon: 'iconfont-chat', onClick: props.onChat, title: 'Add to channels...'},
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
      ]}
      visible={showingPopup}
      onHidden={() => setShowingPopup(false)}
      closeOnSelect={true}
      attachTo={attachTo}
      position="bottom left"
      positionFallbacks={['top left']}
    />
  ))

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
              <Kb.ConnectedUsernames type="BodySemibold" usernames={[props.username]} />
            </Kb.Box>
            <Kb.Box style={styles.nameContainerInner}>
              {fullNameLabel}
              {crown}
              {!active && (
                <Kb.Text type="BodySmall" style={styles.lockedOutOrDeleted}>
                  {props.status === 'reset' ? 'LOCKED OUT' : 'DELETED'}
                </Kb.Text>
              )}
              <Kb.Text type="BodySmall">
                {roleLabel}
                {resetLabel}
              </Kb.Text>
            </Kb.Box>
          </Kb.Box>
        </Kb.ClickableBox>
        {!active && !Styles.isMobile && props.youCanManageMembers && (
          <Kb.Box style={styles.buttonBarContainer}>
            <Kb.ButtonBar>
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
        {flags.teamsRedesign && (
          <>
            <Kb.Button
              mode="Secondary"
              type="Dim"
              small={true}
              icon="iconfont-ellipsis"
              tooltip=""
              style={styles.menuButton}
              onClick={toggleShowingPopup}
              ref={popupAnchor}
            />
            {popup}
          </>
        )}
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
  fullNameLabel: {marginRight: Styles.globalMargins.xtiny},
  innerContainerBottom: {...Styles.globalStyles.flexBoxRow, flexShrink: 1},
  innerContainerTop: {
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
    alignItems: 'center',
    flexShrink: 0,
    height: Styles.isMobile ? 56 : 48,
    width: '100%',
  },
  lockedOutOrDeleted: {
    ...Styles.globalStyles.fontBold,
    backgroundColor: Styles.globalColors.red,
    color: Styles.globalColors.white,
    marginRight: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xtiny,
    paddingRight: Styles.globalMargins.xtiny,
  },
  menuButton: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  nameContainer: {...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small},
  nameContainerInner: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
}))
