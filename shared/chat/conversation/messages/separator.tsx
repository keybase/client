import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {formatTimeForConversationList, formatTimeForChat} from '@/util/timestamp'
import {OrangeLineContext} from '../orange-line-context'
import {useTrackerState} from '@/stores/tracker'
import {useProfileState} from '@/stores/profile'

const missingMessage = Chat.makeMessageDeleted({})

// Single merged selector replacing useStateFast + useState
const useSeparatorData = (trailingItem: T.Chat.Ordinal, leadingItem: T.Chat.Ordinal) => {
  const ordinal = Kb.Styles.isMobile ? leadingItem : trailingItem
  const orangeOrdinal = React.useContext(OrangeLineContext)

  return Chat.useChatContext(
    C.useShallow(s => {
      const previous = s.separatorMap.get(ordinal) ?? T.Chat.numberToOrdinal(0)
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const showUsername = s.showUsernameMap.get(ordinal) ?? ''
      const tooSoon = !m.timestamp || new Date().getTime() - m.timestamp < 1000 * 60 * 60 * 2
      const orangeMessage = orangeOrdinal ? s.messageMap.get(orangeOrdinal) : undefined
      const orangeOrdinalExists =
        orangeOrdinal && s.messageMap.has(orangeOrdinal) && orangeMessage?.type !== 'placeholder'
      const orangeLineAbove =
        orangeOrdinalExists &&
        (orangeOrdinal === ordinal || (orangeOrdinal < ordinal && orangeOrdinal > previous))
      const isJoinLeave = m.type === 'systemJoined'
      const orangeTime =
        !C.isMobile && !showUsername && !tooSoon && !isJoinLeave
          ? formatTimeForConversationList(m.timestamp)
          : ''

      if (!showUsername) {
        return {
          author: '',
          botAlias: '',
          isAdhocBot: false,
          orangeLineAbove,
          orangeTime,
          ordinal,
          showUsername,
          teamID: '' as T.Teams.TeamID,
          teamType: 'adhoc' as T.Teams.TeamType,
          teamname: '',
          timestamp: 0,
        }
      }

      const {author, timestamp} = m
      const {teamID, botAliases, teamType, teamname} = s.meta
      const participantInfoNames = s.participants.name
      const isAdhocBot =
        teamType === 'adhoc' && participantInfoNames.length > 0
          ? !participantInfoNames.includes(author)
          : false

      return {
        author,
        botAlias: botAliases[author] ?? '',
        isAdhocBot,
        orangeLineAbove,
        orangeTime,
        ordinal,
        showUsername,
        teamID,
        teamType,
        teamname,
        timestamp,
      }
    })
  )
}

type AuthorProps = {
  author: string
  botAlias: string
  isAdhocBot: boolean
  teamID: T.Teams.TeamID
  teamType: T.Teams.TeamType
  teamname: string
  timestamp: number
  showUsername: string
}

// Separate component so useTeamsState/useProfileState/useTrackerState only
// subscribe when there's actually an author to show.
function AuthorSection(p: AuthorProps) {
  const {author, botAlias, isAdhocBot, teamID, teamType, teamname, timestamp, showUsername} = p

  const authorRoleInTeam = useTeamsState(s => s.teamIDToMembers.get(teamID)?.get(author)?.type)
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const showUser = useTrackerState(s => s.dispatch.showUser)

  const onAuthorClick = () => {
    if (C.isMobile) {
      showUserProfile(showUsername)
    } else {
      showUser(showUsername, true)
    }
  }

  const authorIsOwner = authorRoleInTeam === 'owner'
  const authorIsAdmin = authorRoleInTeam === 'admin'
  const authorIsBot = teamname
    ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
    : isAdhocBot
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
      className="separator-text"
    />
  )

  const ownerAdminTooltipIcon = allowCrown ? (
    <Kb.Box2 direction="vertical" tooltip={authorIsOwner ? 'Owner' : 'Admin'}>
      <Kb.Icon
        color={authorIsOwner ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35}
        fontSize={10}
        type="iconfont-crown-owner"
      />
    </Kb.Box2>
  ) : null

  const botIcon = authorIsBot ? (
    <Kb.Box2 direction="vertical" tooltip="Bot">
      <Kb.Icon fontSize={13} color={Kb.Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.Box2>
  ) : null

  const botAliasOrUsername = botAlias ? (
    <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1} className="separator-text">
      {botAlias} {' [' + showUsername + ']'}
    </Kb.Text>
  ) : (
    usernameNode
  )

  return (
    <>
      <Kb.Avatar size={32} username={showUsername} onClick={onAuthorClick} style={styles.avatar} />
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
          <Kb.Text type="BodyTiny" virtualText={true} className="separator-text">
            {formatTimeForChat(timestamp)}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

type Props = {
  leadingItem?: T.Chat.Ordinal
  trailingItem: T.Chat.Ordinal
}

function SeparatorConnector(p: Props) {
  const {leadingItem, trailingItem} = p
  const data = useSeparatorData(trailingItem, leadingItem ?? T.Chat.numberToOrdinal(0))
  const {ordinal, showUsername, orangeLineAbove, orangeTime} = data

  if (!ordinal || (!showUsername && !orangeLineAbove)) return null

  return (
    <Kb.Box2
      direction="horizontal"
      style={showUsername ? styles.container : styles.containerNoName}
      fullWidth={true}
      pointerEvents="box-none"
      className="WrapperMessage-hoverColor"
    >
      {showUsername ? (
        <AuthorSection
          author={data.author}
          botAlias={data.botAlias}
          isAdhocBot={data.isAdhocBot}
          teamID={data.teamID}
          teamType={data.teamType}
          teamname={data.teamname}
          timestamp={data.timestamp}
          showUsername={showUsername}
        />
      ) : null}
      {orangeLineAbove ? (
        <Kb.Box2 key="orangeLine" direction="vertical" style={styles.orangeLine}>
          {orangeTime ? (
            <Kb.Text type="BodyTiny" key="orangeLineLabel" style={styles.orangeLabel}>
              {orangeTime}
            </Kb.Text>
          ) : null}
        </Kb.Box2>
      ) : null}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          marginLeft: Kb.Styles.isMobile ? 48 : 56,
        },
        isElectron: {
          marginBottom: 0,
          marginTop: 0,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Kb.Styles.platformStyles({
        common: {position: 'absolute', top: 4},
        isElectron: {
          left: Kb.Styles.globalMargins.small,
          top: 4,
          zIndex: 2,
        },
        isMobile: {left: Kb.Styles.globalMargins.tiny},
      }),
      botAlias: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black},
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {maxWidth: 120},
      }),
      container: Kb.Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          height: 21,
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      containerNoName: Kb.Styles.platformStyles({
        common: {
          position: 'relative',
        },
        isElectron: {
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      orangeLabel: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderBottomRightRadius: 4,
        color: Kb.Styles.globalColors.white,
        left: 0,
        opacity: 0.7,
        paddingLeft: 2,
        paddingRight: 2,
        position: 'absolute',
        top: 0,
      },
      orangeLine: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.orange,
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
      usernameCrown: Kb.Styles.platformStyles({
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
