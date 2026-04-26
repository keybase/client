import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/constants/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import BotMenu from './bot-menu'
import {useFeaturedBot} from '@/util/featured-bots'
import {navToProfile} from '@/constants/router'
import {useLoadedTeam} from '../../use-loaded-team'

export type Props = {
  botAlias: string
  canManageBots: boolean
  description: string
  onClick: () => void
  onEdit: () => void
  onOpenProfile: () => void
  onRemove: () => void
  ownerTeam?: string | undefined
  ownerUser?: string | undefined
  roleType: T.Teams.TeamRoleType
  status: T.Teams.MemberStatus
  username: string
}

// NOTE the controls for reset and deleted users (and the chat button) are
// duplicated here because the desktop & mobile layouts differ significantly. If
// you're changing one remember to change the other.

export const TeamBotRow = (props: Props) => {
  let descriptionLabel: React.ReactNode = null
  const popupAnchor = React.useRef<Kb.MeasureRef | null>(null)
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
        onClick={props.onOpenProfile}
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

  // TODO: switch this to a ListItem so that we get dividers, free styling, etc
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" style={Kb.Styles.collapseStyles([styles.container, !active && styles.containerReset])}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.innerContainerTop}>
        <Kb.Box2 direction="horizontal" alignItems="center" flex={1}>
          <Kb.Avatar
            username={props.username}
            size={Kb.Styles.isMobile ? 48 : 32}
            onClick={props.onOpenProfile}
          />
          <Kb.Box2 direction="vertical" style={styles.nameContainer}>
            <Kb.Box2 direction="horizontal" fullWidth={true}>{usernameDisplay}</Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">{descriptionLabel}</Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.menuIconContainer} ref={popupAnchor}>
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
            attachTo={Kb.Styles.isMobile ? undefined : popupAnchor}
            canManageBots={props.canManageBots}
            visible={showMenu}
            onEdit={props.onEdit}
            onRemove={props.onRemove}
            onHidden={_onHideMenu}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Kb.Styles.globalColors.white,
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  containerReset: {
    backgroundColor: Kb.Styles.globalColors.blueLighter2,
  },
  fullNameLabel: {marginRight: Kb.Styles.globalMargins.xtiny},
  innerContainerTop: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
    flexShrink: 0,
    height: Kb.Styles.isMobile ? 56 : 48,
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
    flexShrink: 1,
    height: '100%',
  },
  nameContainer: {marginLeft: Kb.Styles.globalMargins.small},
}))

type OwnProps = {
  teamID: T.Teams.TeamID
  username: string
}

const blankInfo = Teams.initialMemberInfo

const Container = (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const {teamDetails, yourOperations} = useLoadedTeam(teamID)
  const info: T.Teams.MemberInfo = teamDetails.members.get(ownProps.username) || blankInfo
  const canManageBots = yourOperations.manageBots
  const _bot = useFeaturedBot(ownProps.username)
  const bot = _bot ?? {
    botAlias: info.fullName,
    botUsername: ownProps.username,
    description: '',
    extendedDescription: '',
    extendedDescriptionRaw: '',
    isPromoted: false,
    rank: 0,
  }

  const {botAlias, description} = bot

  const ownerTeam = bot.ownerTeam || undefined
  const ownerUser = bot.ownerUser || undefined
  const roleType = info.type
  const status = info.status
  const username = info.username
  const onOpenProfile = () => navToProfile(ownProps.username)
  const navigateAppend = C.Router2.navigateAppend
  const onClick = () => {
    navigateAppend({name: 'teamMember', params: ownProps})
  }
  const onEdit = () => {
    navigateAppend({
      name: 'chatInstallBot',
      params: {botUsername: ownProps.username, teamID: ownProps.teamID},
    })
  }
  const onRemove = () => {
    navigateAppend({
      name: 'chatConfirmRemoveBot',
      params: {botUsername: ownProps.username, teamID: ownProps.teamID},
    })
  }
  const props = {
    botAlias: botAlias,
    canManageBots: canManageBots,
    description: description,
    onClick: onClick,
    onEdit: onEdit,
    onOpenProfile: onOpenProfile,
    onRemove: onRemove,
    ownerTeam: ownerTeam,
    ownerUser: ownerUser,
    roleType: roleType,
    status: status,
    username: username,
  }
  return <TeamBotRow {...props} />
}

export default Container
