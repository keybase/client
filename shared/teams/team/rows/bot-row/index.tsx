import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {typeToLabel} from '../../../../constants/teams'
import {MemberStatus, TeamRoleType} from '../../../../constants/types/teams'

export type Props = {
  botAlias: string
  description: string
  onClick: () => void
  onReAddToTeam: () => void
  onRemoveFromTeam: () => void
  onShowTracker: () => void
  ownerTeam?: string
  ownerUser?: string
  roleType: TeamRoleType
  status: MemberStatus
  username: string
  youCanManageMembers: boolean
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamBotRow = (props: Props) => {
  let descriptionLabel
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
      <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.black}}>
        {props.botAlias || props.username}
      </Kb.Text>
      <Kb.Text type="BodySmall">
        &nbsp;• by{' '}
        {props.ownerTeam ? (
          <Kb.Text type="BodySmall">@{props.ownerTeam}</Kb.Text>
        ) : (
          <Kb.ConnectedUsernames
            prefix="@"
            inline={true}
            usernames={[props.ownerUser ?? props.username]}
            type="BodySmall"
            withProfileCardPopup={true}
          />
        )}
      </Kb.Text>
    </Kb.Box2>
  )

  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, !active && styles.containerReset])}>
      <Kb.Box style={styles.innerContainerTop}>
        <Kb.ClickableBox
          style={styles.clickable}
          onClick={active ? props.onClick : props.status === 'deleted' ? undefined : props.onShowTracker}
        >
          <Kb.Avatar username={props.username} size={Styles.isMobile ? 48 : 32} />
          <Kb.Box style={styles.nameContainer}>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>{usernameDisplay}</Kb.Box>
            <Kb.Box style={styles.nameContainerInner}>{descriptionLabel}</Kb.Box>
          </Kb.Box>
        </Kb.ClickableBox>
      </Kb.Box>
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
  nameContainer: {...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small},
  nameContainerInner: {...Styles.globalStyles.flexBoxRow, alignItems: 'center'},
}))
