import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  ButtonBar,
  ClickableBox,
  Text,
  Icon,
  Usernames,
} from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {typeToLabel} from '../../../../constants/teams'
import {isLargeScreen} from '../../../../constants/platform'
import {BoolTypeMap, MemberStatus, TeamRoleType} from '../../../../constants/types/teams'

export type Props = {
  following: boolean
  fullName: string
  onChat: () => void
  onClick: () => void
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
    crown = <Icon type={('iconfont-crown-' + props.roleType) as any} style={styles.crownIcon} fontSize={10} />
  }
  if (props.fullName && active) {
    fullNameLabel = (
      <Text style={styles.fullNameLabel} type="BodySmall">
        {props.fullName} •
      </Text>
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

  return (
    <Box style={Styles.collapseStyles([styles.container, !active && styles.containerReset])}>
      <Box style={styles.innerContainerTop}>
        <ClickableBox
          style={styles.clickable}
          onClick={active ? props.onClick : props.status === 'deleted' ? undefined : props.onShowTracker}
        >
          <Avatar username={props.username} size={Styles.isMobile ? 48 : 32} />
          <Box style={styles.nameContainer}>
            <Box style={Styles.globalStyles.flexBoxRow}>
              <Usernames
                type="BodySemibold"
                colorFollowing={true}
                users={[
                  {following: props.following, username: props.username, you: props.you === props.username},
                ]}
              />
            </Box>
            <Box style={styles.nameContainerInner}>
              {fullNameLabel}
              {crown}
              {!active && (
                <Text type="BodySmall" style={styles.lockedOutOrDeleted}>
                  {props.status === 'reset' ? 'LOCKED OUT' : 'DELETED'}
                </Text>
              )}
              <Text type="BodySmall">
                {!!active && !!props.roleType && typeToLabel[props.roleType]}
                {resetLabel}
              </Text>
            </Box>
          </Box>
        </ClickableBox>
        {!active && !Styles.isMobile && props.youCanManageMembers && (
          <Box style={styles.buttonBarContainer}>
            <ButtonBar>
              {props.status !== 'deleted' && (
                <Button
                  small={true}
                  label="Re-Admit"
                  onClick={props.onReAddToTeam}
                  type="Success"
                  waiting={props.waitingForAdd}
                  disabled={props.waitingForRemove}
                />
              )}
              <Button
                small={true}
                label="Remove"
                onClick={props.onRemoveFromTeam}
                type="Dim"
                waiting={props.waitingForRemove}
                disabled={props.waitingForAdd}
              />
            </ButtonBar>
          </Box>
        )}
        <Box style={styles.chatIconContainer}>
          {(active || isLargeScreen) && (
            // Desktop & mobile large screen - display on the far right of the first row
            // Also when user is active
            <Icon
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
        </Box>
      </Box>
      {!active && Styles.isMobile && props.youCanManageMembers && (
        <Box style={styles.innerContainerBottom}>
          <ButtonBar direction="row">
            {props.status !== 'deleted' && (
              <Button
                small={true}
                label="Re-Admit"
                onClick={props.onReAddToTeam}
                type="Success"
                waiting={props.waitingForAdd}
                disabled={props.waitingForRemove}
              />
            )}
            <Button
              small={true}
              label="Remove"
              onClick={props.onRemoveFromTeam}
              type="Dim"
              waiting={props.waitingForRemove}
              disabled={props.waitingForAdd}
            />
          </ButtonBar>
          {!isLargeScreen && (
            // Mobile small screens - for inactive user
            // display next to reset / deleted controls
            <Icon
              onClick={props.onChat}
              style={Styles.collapseStyles([
                styles.chatButtonMobile,
                active && styles.chatButtonMobileSmallTop,
              ])}
              fontSize={20}
              type="iconfont-chat"
            />
          )}
        </Box>
      )}
    </Box>
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
    alignItems: 'center',
    flexShrink: 0,
    height: Styles.isMobile ? 56 : 48,
    padding: Styles.globalMargins.tiny,
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
  nameContainer: {...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small},
  nameContainerInner: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
}))
