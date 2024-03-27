import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
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
  roleType: T.Teams.TeamRoleType
  status: T.Teams.MemberStatus
  username: string
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamBotRow = (props: Props) => {
  let descriptionLabel: React.ReactNode = null
  const popupAnchor = React.useRef<Kb.MeasureRef>(null)
  const [showMenu, setShowMenu] = React.useState(false)

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
        style={{color: Kb.Styles.globalColors.black}}
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
    <Kb.Box style={Kb.Styles.collapseStyles([styles.container, !active && styles.containerReset])}>
      <Kb.Box style={styles.innerContainerTop}>
        <Kb.Box style={styles.clickable}>
          <Kb.Avatar
            username={props.username}
            size={Kb.Styles.isMobile ? 48 : 32}
            onClick={props.onShowTracker}
          />
          <Kb.Box style={styles.nameContainer}>
            <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>{usernameDisplay}</Kb.Box>
            <Kb.Box style={styles.nameContainerInner}>{descriptionLabel}</Kb.Box>
          </Kb.Box>
        </Kb.Box>
        <Kb.Box2Measure direction="vertical" style={styles.menuIconContainer} ref={popupAnchor}>
          {(active || C.isLargeScreen) && (
            // Desktop & mobile large screen - display on the far right of the first row
            // Also when user is active
            <Kb.Icon
              onClick={_onShowMenu}
              style={
                Kb.Styles.isMobile
                  ? Kb.Styles.collapseStyles([styles.menuButtonMobile, styles.menuButtonMobileSmallTop])
                  : styles.menuButtonDesktop
              }
              fontSize={Kb.Styles.isMobile ? 20 : 16}
              type="iconfont-ellipsis"
            />
          )}
          <BotMenu
            attachTo={popupAnchor}
            canManageBots={props.canManageBots}
            visible={showMenu}
            onEdit={props.onEdit}
            onRemove={props.onRemove}
            onHidden={_onHideMenu}
          />
        </Kb.Box2Measure>
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBarContainer: {...Kb.Styles.globalStyles.flexBoxRow, flexShrink: 1},
  clickable: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexGrow: 1,
  },
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Kb.Styles.globalColors.white,
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  containerReset: {
    backgroundColor: Kb.Styles.globalColors.blueLighter2,
  },
  crownIcon: {
    marginRight: Kb.Styles.globalMargins.xtiny,
  },
  fullNameLabel: {marginRight: Kb.Styles.globalMargins.xtiny},
  innerContainerBottom: {...Kb.Styles.globalStyles.flexBoxRow, flexShrink: 1},
  innerContainerTop: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
    alignItems: 'center',
    flexShrink: 0,
    height: Kb.Styles.isMobile ? 56 : 48,
    width: '100%',
  },
  lockedOutOrDeleted: {
    ...Kb.Styles.globalStyles.fontBold,
    backgroundColor: Kb.Styles.globalColors.red,
    color: Kb.Styles.globalColors.white,
    marginRight: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.xtiny,
    paddingRight: Kb.Styles.globalMargins.xtiny,
  },
  menuButtonDesktop: {
    marginLeft: Kb.Styles.globalMargins.small,
    marginRight: Kb.Styles.globalMargins.tiny,
    padding: Kb.Styles.globalMargins.tiny,
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
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 1,
    height: '100%',
  },
  nameContainer: {...Kb.Styles.globalStyles.flexBoxColumn, marginLeft: Kb.Styles.globalMargins.small},
  nameContainerInner: {...Kb.Styles.globalStyles.flexBoxRow, alignItems: 'center'},
}))
