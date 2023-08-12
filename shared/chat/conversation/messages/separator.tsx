import * as C from '../../../constants'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as ProfileConstants from '../../../constants/profile'
import * as Constants from '../../../constants/chat2'
import * as TrackerConstants from '../../../constants/tracker2'
import * as TeamsConstants from '../../../constants/teams'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
import {formatTimeForChat} from '../../../util/timestamp'
import {SeparatorMapContext} from './ids-context'
import {usingFlashList} from '../list-area/flashlist-config'
import shallowEqual from 'shallowequal'

const enoughTimeBetweenMessages = (mtimestamp?: number, ptimestamp?: number): boolean =>
  !!ptimestamp && !!mtimestamp && mtimestamp - ptimestamp > 1000 * 60 * 15

// Used to decide whether to show the author for sequential messages
const authorIsCollapsible = (type?: Types.MessageType) =>
  type === 'text' || type === 'deleted' || type === 'attachment'

const getUsernameToShow = (message: Types.Message, pMessage: Types.Message | undefined, you: string) => {
  switch (message.type) {
    case 'journeycard': // fallthrough
    case 'systemJoined':
      return ''
    case 'systemAddedToTeam':
      return message.adder
    case 'systemInviteAccepted':
      return message.invitee === you ? '' : message.invitee
    case 'setDescription': // fallthrough
    case 'pin': // fallthrough
    case 'systemUsersAddedToConversation':
      return message.author
    case 'systemSBSResolved':
      return message.prover
    case 'setChannelname':
      // suppress this message for the #general channel, it is redundant.
      return message.newChannelname !== 'general' ? message.author : ''
    case 'attachment': // fallthrough
    case 'requestPayment': // fallthrough
    case 'sendPayment': // fallthrough
    case 'text':
      break
    default:
      return message.author
  }

  if (!pMessage) return message.author

  if (
    !pMessage.type ||
    pMessage.author !== message.author ||
    pMessage.botUsername !== message.botUsername ||
    !authorIsCollapsible(message.type) ||
    !authorIsCollapsible(pMessage.type) ||
    enoughTimeBetweenMessages(message.timestamp, pMessage.timestamp)
  ) {
    return message.author
  }
  // should be impossible
  return ''
}

// Author Avatar
type LProps = {
  username?: string
}
const LeftSide = React.memo(function LeftSide(p: LProps) {
  const {username} = p
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onAuthorClick = React.useCallback(() => {
    if (!username) return
    if (Container.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }, [showUserProfile, showUser, username])

  return username ? (
    <Kb.Avatar
      size={32}
      username={username}
      skipBackground={true}
      onClick={onAuthorClick}
      style={styles.avatar}
    />
  ) : null
})

type TProps = {
  showUsername: string
  authorRoleInTeam?: string
  authorIsBot: boolean
  botAlias: string
  timestamp: number
  teamType: Types.TeamType
}
const TopSide = React.memo(function TopSide(p: TProps) {
  const {timestamp, botAlias, showUsername, authorIsBot, authorRoleInTeam, teamType} = p
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onAuthorClick = React.useCallback(() => {
    if (Container.isMobile) {
      showUsername && showUserProfile(showUsername)
    } else {
      showUsername && showUser(showUsername, true)
    }
  }, [showUser, showUsername, showUserProfile])

  const authorIsOwner = authorRoleInTeam === 'owner'
  const authorIsAdmin = authorRoleInTeam === 'admin'
  const allowCrown = teamType !== 'adhoc' && (authorIsOwner || authorIsAdmin)

  const usernameNode = (
    <Kb.ConnectedUsernames
      colorBroken={true}
      colorFollowing={true}
      colorYou={true}
      onUsernameClicked={onAuthorClick}
      fixOverdraw="auto"
      type="BodySmallBold"
      usernames={showUsername}
      virtualText={true}
    />
  )

  const ownerAdminTooltipIcon = allowCrown ? (
    <Kb.WithTooltip tooltip={authorIsOwner ? 'Owner' : 'Admin'}>
      <Kb.Icon
        color={authorIsOwner ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
        fontSize={10}
        type="iconfont-crown-owner"
      />
    </Kb.WithTooltip>
  ) : null

  const botIcon = authorIsBot ? (
    <Kb.WithTooltip tooltip="Bot">
      <Kb.Icon fontSize={13} color={Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.WithTooltip>
  ) : null

  const botAliasOrUsername = botAlias ? (
    <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1}>
      {botAlias} {' [' + showUsername + ']'}
    </Kb.Text>
  ) : (
    usernameNode
  )

  const canFixOverdraw = React.useContext(Styles.CanFixOverdrawContext)
  const timestampNode = (
    <Kb.Text type="BodyTiny" fixOverdraw={canFixOverdraw} virtualText={true}>
      {formatTimeForChat(timestamp)}
    </Kb.Text>
  )

  return (
    <Kb.Box2
      pointerEvents="box-none"
      key="author"
      direction="horizontal"
      style={styles.authorContainer}
      gap="tiny"
    >
      <Kb.Box2
        pointerEvents="box-none"
        direction="horizontal"
        gap="xtiny"
        fullWidth={true}
        style={styles.usernameCrown}
      >
        {botAliasOrUsername}
        {ownerAdminTooltipIcon}
        {botIcon}
        {timestampNode}
      </Kb.Box2>
    </Kb.Box2>
  )
})

const missingMessage = Constants.makeMessageDeleted({})

const useReduxFast = (trailingItem: Types.Ordinal, leadingItem: Types.Ordinal) => {
  const sm = React.useContext(SeparatorMapContext)
  // in flat list we get the leadingItem but its the opposite of what we want
  // we derive the previous by using SeparatorMapContext
  if (Styles.isMobile && !usingFlashList) {
    trailingItem = leadingItem
    leadingItem = sm.get(trailingItem) ?? 0
  }
  const you = C.useCurrentUserState(s => s.username)
  const orangeOrdinal = Constants.useContext(s => s.orangeLine)
  return Constants.useContext(s => {
    let ordinal = trailingItem
    let previous = leadingItem

    const pmessage = s.messageMap.get(previous)
    const m = s.messageMap.get(ordinal) ?? missingMessage
    const showUsername = m && getUsernameToShow(m, pmessage, you)
    const orangeLineAbove = orangeOrdinal == ordinal
    return {orangeLineAbove, ordinal, showUsername}
  }, shallowEqual)
}

const useRedux = (ordinal: Types.Ordinal) => {
  const participantInfoNames = Constants.useContext(s => s.participants.name)
  const meta = Constants.useContext(s => s.meta)
  const d = Constants.useContext(s => {
    const m = s.messageMap.get(ordinal) ?? missingMessage
    const {author, timestamp} = m
    const {teamID, botAliases, teamType} = meta
    // TODO not reactive
    const authorRoleInTeam = TeamsConstants.useState
      .getState()
      .teamIDToMembers.get(teamID ?? '')
      ?.get(author)?.type
    const botAlias = botAliases[author] ?? ''
    const authorIsBot = meta.teamname
      ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
      : teamType === 'adhoc' && participantInfoNames.length > 0 // teams without info may have type adhoc with an empty participant name list
      ? !participantInfoNames.includes(author) // if adhoc, check if author in participants
      : false
    return {
      authorIsBot,
      authorRoleInTeam,
      botAlias,
      teamType,
      timestamp,
    }
  }, shallowEqual)
  return {...d, participantInfoNames}
}

type SProps = {
  ordinal: Types.Ordinal
  showUsername: string
  orangeLineAbove: boolean
}
const Separator = React.memo(function Separator(p: SProps) {
  const {ordinal, orangeLineAbove, showUsername} = p
  const mdata = useRedux(ordinal)
  const {botAlias, authorRoleInTeam, authorIsBot, timestamp, teamType} = mdata

  return (
    <Kb.Box2
      direction="horizontal"
      style={showUsername ? styles.container : styles.containerNoName}
      fullWidth={true}
      pointerEvents="box-none"
      className="WrapperMessage-hoverColor"
    >
      {showUsername ? <LeftSide username={showUsername} /> : null}
      {showUsername ? (
        <TopSide
          showUsername={showUsername}
          botAlias={botAlias}
          timestamp={timestamp}
          authorRoleInTeam={authorRoleInTeam}
          authorIsBot={authorIsBot}
          teamType={teamType}
        />
      ) : null}
      {orangeLineAbove ? <Kb.Box2 key="orangeLine" direction="vertical" style={styles.orangeLine} /> : null}
    </Kb.Box2>
  )
})

type Props = {
  leadingItem?: Types.Ordinal
  trailingItem: Types.Ordinal
}

const SeparatorConnector = (p: Props) => {
  const {leadingItem, trailingItem} = p
  const {ordinal, showUsername, orangeLineAbove} = useReduxFast(trailingItem ?? 0, leadingItem ?? 0)
  return ordinal && (showUsername || orangeLineAbove) ? (
    <Separator ordinal={ordinal} showUsername={showUsername} orangeLineAbove={orangeLineAbove} />
  ) : null
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          marginLeft: Styles.isMobile ? 48 : 56,
        },
        isElectron: {
          marginBottom: 0,
          marginTop: 0,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Styles.platformStyles({
        common: {position: 'absolute', top: 4},
        isElectron: {
          left: Styles.globalMargins.small,
          top: 4,
          zIndex: 2,
        },
        isMobile: {left: Styles.globalMargins.tiny},
      }),
      botAlias: Styles.platformStyles({
        common: {color: Styles.globalColors.black},
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {maxWidth: 120},
      }),
      container: Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          height: 21,
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      containerNoName: Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      orangeLine: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.orange,
          flexShrink: 0,
          height: 1,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        isElectron: {
          // we're inside a padded container so just bust out a little
          right: -16,
        },
      }),
      usernameCrown: Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
          marginRight: 48,
          position: 'relative',
          top: -2,
        },
        isMobile: {alignItems: 'center'},
      }),
    }) as const
)

export default SeparatorConnector
