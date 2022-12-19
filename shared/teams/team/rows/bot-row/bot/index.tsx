import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {isLargeScreen} from '../../../../../constants/platform'
import type {MemberStatus, TeamRoleType} from '../../../../../constants/types/teams'
import BotMenu from '../bot-menu'

export type Props = {
  botAlias: string
  canManageBots: boolean
  description: string
  onClick: () => void
  onEdit: () => void
  onRemove: () => void
  onShowTracker: () => void
  ownerTeam?: string
  ownerUser?: string
  roleType: TeamRoleType
  status: MemberStatus
  username: string
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamBotRow = (props: Props) => {
  let descriptionLabel
  const menuRef = React.useRef<Kb.Box>(null)
  const [showMenu, setShowMenu] = React.useState(false)

  const _getAttachmentRef = () => menuRef.current
  const _onShowMenu = () => setShowMenu(true)
  const _onHideMenu = () => setShowMenu(false)
  const active = props.status === 'active'
  if (props.description.length > 0) {
    descriptionLabel = (
      <Kb.Text style={styles.fullNameLabel} type="BodySmall" lineClamp={1}>
        {props.description}
      </Kb.Text>
    )
  }

  const usernameDisplay = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      <Kb.Text
        type="BodySmallSemibold"
        style={{color: Styles.globalColors.black}}
        onClick={props.onShowTracker}
      >
        {props.botAlias || props.username}
      </Kb.Text>
      <Kb.Text type="BodySmall">&nbsp;• by&nbsp;</Kb.Text>
      {props.ownerTeam ? (
        <Kb.Text type="BodySmall">{`@${props.ownerTeam}`}</Kb.Text>
      ) : (
        <Kb.ConnectedUsernames
          prefix="@"
          inline={true}
          usernames={props.ownerUser ?? props.username}
          type="BodySmallBold"
          withProfileCardPopup={true}
          onUsernameClicked="profile"
        />
      )}
    </Kb.Box2>
  )

  // TODO: switch this to a ListItem2 so that we get dividers, free styling, etc
  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, !active && styles.containerReset])}>
      <Kb.Box style={styles.innerContainerTop}>
        <Kb.Box style={styles.clickable}>
          <Kb.Avatar
            username={props.username}
            size={Styles.isMobile ? 48 : 32}
            onClick={props.onShowTracker}
          />
          <Kb.Box style={styles.nameContainer}>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>{usernameDisplay}</Kb.Box>
            <Kb.Box style={styles.nameContainerInner}>{descriptionLabel}</Kb.Box>
          </Kb.Box>
        </Kb.Box>
        <Kb.Box style={styles.menuIconContainer} ref={menuRef}>
          {(active || isLargeScreen) && (
            // Desktop & mobile large screen - display on the far right of the first row
            // Also when user is active
            <Kb.Icon
              onClick={_onShowMenu}
              style={
                Styles.isMobile
                  ? Styles.collapseStyles([styles.menuButtonMobile, styles.menuButtonMobileSmallTop])
                  : styles.menuButtonDesktop
              }
              fontSize={Styles.isMobile ? 20 : 16}
              type="iconfont-ellipsis"
            />
          )}
          <BotMenu
            attachTo={_getAttachmentRef}
            canManageBots={props.canManageBots}
            visible={showMenu}
            onEdit={props.onEdit}
            onRemove={props.onRemove}
            onHidden={_onHideMenu}
          />
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  buttonBarContainer: {...Styles.globalStyles.flexBoxRow, flexShrink: 1},
  clickable: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexGrow: 1,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
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
  menuButtonDesktop: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.tiny,
    padding: Styles.globalMargins.tiny,
  },
  menuButtonMobile: {
    position: 'absolute',
    right: 16,
    top: 24,
  },
  menuButtonMobileSmallTop: {
    top: 12,
  },
  menuIconContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 1,
    height: '100%',
  },
  nameContainer: {...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small},
  nameContainerInner: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
}))
