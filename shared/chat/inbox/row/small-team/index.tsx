import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import type * as React from 'react'
import * as Kb from '@/common-adapters'
import * as RowSizes from '../sizes'
import * as T from '@/constants/types'
import SwipeConvActions from './swipe-conv-actions'
import './small-team.css'
import {Avatars, TeamAvatar} from '@/chat/avatars'
import {formatTimeForConversationList} from '@/util/timestamp'
import {useCurrentUserState} from '@/stores/current-user'
import {useOpenedRowState} from '../opened-row-state'
import TeamMenu from '@/chat/conversation/info-panel/menu'

export type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  isInWidget: boolean
  isSelected: boolean
  layoutIsTeam?: boolean
  layoutName?: string
  layoutSnippet?: string
  layoutTime?: number
  layoutSnippetDecoration?: T.RPCChat.SnippetDecoration
  onSelectConversation?: () => void
}

const SmallTeam = (p: Props) => {
  return (
    <Chat.ChatProvider id={p.conversationIDKey}>
      <SmallTeamInner {...p} />
    </Chat.ChatProvider>
  )
}

const SmallTeamInner = (p: Props) => {
  const {layoutName, layoutIsTeam, layoutSnippet, isSelected, layoutTime, layoutSnippetDecoration, isInWidget} = p

  const you = useCurrentUserState(s => s.username)

  const {snippet, snippetDecoration, isMuted, isLocked, hasUnread, hasBadge, timestamp, navigateToThread} =
    Chat.useChatContext(
      C.useShallow(s => {
        const typingSnippet = (() => {
          const typers = !isInWidget ? s.typing : undefined
          if (!typers?.size) return undefined
          if (typers.size === 1) {
            const [t] = typers
            return `${t} is typing...`
          } else {
            return 'Multiple people typing...'
          }
        })()
        const {meta} = s
        const maybeLayoutSnippet =
          meta.conversationIDKey === Chat.noConversationIDKey ? layoutSnippet : undefined
        const snippet = typingSnippet ?? meta.snippetDecorated ?? maybeLayoutSnippet ?? ''
        const snippetDecoration =
          meta.conversationIDKey === Chat.noConversationIDKey
            ? (layoutSnippetDecoration ?? T.RPCChat.SnippetDecoration.none)
            : meta.snippetDecoration

        return {
          hasBadge: s.badge > 0,
          hasUnread: s.unread > 0,
          isLocked: meta.rekeyers.has(you) || meta.rekeyers.size > 0 || !!meta.wasFinalizedBy,
          isMuted: meta.isMuted,
          navigateToThread: s.dispatch.navigateToThread,
          snippet,
          snippetDecoration,
          timestamp: meta.timestamp || layoutTime || 0,
        }
      })
    )

  const participants = Chat.useChatContext(
    C.useShallow(s => {
      const {meta} = s
      const participantInfo = s.participants
      const teamname = (meta.teamname || layoutIsTeam ? layoutName : '') || ''
      const channelname = isInWidget ? meta.channelname : ''
      if (teamname && channelname) {
        return `${teamname}#${channelname}`
      }
      if (participantInfo.name.length) {
        return participantInfo.name.filter((participant, _, list) =>
          list.length === 1 ? true : participant !== you
        )
      }
      if (layoutIsTeam && layoutName) {
        return [layoutName]
      }
      return (
        layoutName
          ?.split(',')
          .filter((participant, _, list) => (list.length === 1 ? true : participant !== you)) ?? []
      )
    })
  )

  const setOpenedRow = useOpenedRowState(s => s.dispatch.setOpenRow)
  const onSelectConversation = isSelected
    ? undefined
    : (p.onSelectConversation ??
        (() => {
          setOpenedRow(Chat.noConversationIDKey)
          navigateToThread('inboxSmall')
        }))

  const backgroundColor = isInWidget
    ? Kb.Styles.globalColors.white
    : isSelected
      ? Kb.Styles.globalColors.blue
      : Kb.Styles.isPhone && !Kb.Styles.isTablet
        ? Kb.Styles.globalColors.fastBlank
        : Kb.Styles.globalColors.blueGrey

  let participantOne = ''
  let participantTwo = ''
  let teamname = ''
  if (typeof participants === 'string') {
    teamname = participants.split('#')[0] ?? ''
  } else if (layoutIsTeam) {
    teamname = participants[0] ?? ''
  } else {
    participantOne = participants[0] ?? ''
    participantTwo = participants[1] ?? ''
  }

  return (
    <SwipeConvActions>
      <Kb.ClickableBox
        onClick={onSelectConversation}
        className={Kb.Styles.classNames('small-row', {selected: isSelected})}
        style={
          isInWidget || Kb.Styles.isTablet
            ? Kb.Styles.collapseStyles([styles.container, {backgroundColor}])
            : styles.container
        }
      >
        <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={Kb.Styles.collapseStyles([styles.rowContainer, styles.fastBlank] as const)}>
          {teamname ? (
            <TeamAvatar teamname={teamname} isMuted={isMuted} isSelected={isSelected} isHovered={false} />
          ) : (
            <Avatars
              backgroundColor={backgroundColor}
              isMuted={isMuted}
              isLocked={isLocked}
              isSelected={isSelected}
              participantOne={participantOne}
              participantTwo={participantTwo}
            />
          )}
          <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.conversationRow, styles.fastBlank])}>
            <Kb.Box2 direction="vertical" style={styles.withBottomLine} fullWidth={true}>
              <TopLine
                isSelected={isSelected}
                isInWidget={isInWidget}
                hasUnread={hasUnread}
                hasBadge={hasBadge}
                participants={participants}
                timestamp={timestamp}
              />
            </Kb.Box2>
            <BottomLine
              snippet={snippet}
              snippetDecoration={snippetDecoration}
              backgroundColor={backgroundColor}
              isSelected={isSelected}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ClickableBox>
    </SwipeConvActions>
  )
}

type TopLineProps = {
  isSelected: boolean
  isInWidget: boolean
  hasUnread: boolean
  hasBadge: boolean
  participants: Array<string> | string
  timestamp: number
}

const TopLine = (p: TopLineProps) => {
  const {isSelected, isInWidget, hasUnread, hasBadge, participants, timestamp} = p
  const showGear = !isInWidget
  const showBold = !isSelected && hasUnread
  const subColor = isSelected
    ? Kb.Styles.globalColors.white
    : hasUnread
      ? Kb.Styles.globalColors.black
      : Kb.Styles.globalColors.black_50
  const iconHoverColor = isSelected ? Kb.Styles.globalColors.white_75 : Kb.Styles.globalColors.black

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <TeamMenu visible={true} attachTo={attachTo} onHidden={hidePopup} hasHeader={true} isSmallTeam={true} />
    )
  }
  const {showingPopup, showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const tssubColor = (!hasBadge || isSelected) && subColor
  const timestampStyle = Kb.Styles.collapseStyles([
    showBold && styles.bold,
    styles.timestamp,
    tssubColor !== false && ({color: tssubColor} as Kb.Styles.StylesCrossPlatform),
  ])
  const timestampText = timestamp ? formatTimeForConversationList(timestamp) : ''

  const usernameColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black
  const nameBackgroundColor = isInWidget
    ? Kb.Styles.globalColors.white
    : isSelected
      ? Kb.Styles.globalColors.blue
      : Kb.Styles.isPhone
        ? Kb.Styles.globalColors.fastBlank
        : Kb.Styles.globalColors.blueGrey
  const nameContainerStyle = Kb.Styles.collapseStyles([
    styles.name,
    showBold && styles.bold,
    {color: usernameColor},
    Kb.Styles.isMobile && {backgroundColor: nameBackgroundColor},
  ])
  const teamContainerStyle = Kb.Styles.collapseStyles([
    styles.teamTextStyle,
    showBold && styles.bold,
    {color: usernameColor},
  ])

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true}>
      {showGear && showingPopup && popup}
      <Kb.Box2 direction="horizontal" style={styles.insideContainer}>
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.nameContainer}>
          {typeof participants === 'string' ? (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Text type="BodySemibold" style={teamContainerStyle}>
                {participants}
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.ConnectedUsernames
              backgroundMode={isSelected ? 'Terminal' : 'Normal'}
              type={showBold ? 'BodyBold' : 'BodySemibold'}
              inline={true}
              withProfileCardPopup={false}
              underline={false}
              colorBroken={false}
              colorFollowing={false}
              colorYou={false}
              commaColor={usernameColor}
              containerStyle={nameContainerStyle}
              usernames={participants}
              title={participants.join(', ')}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Text2 key="timestamp" type="BodyTiny" className="conversation-timestamp" style={timestampStyle}>
        {timestampText}
      </Kb.Text2>
      {!Kb.Styles.isMobile && showGear && (
        <Kb.Icon
          type="iconfont-gear"
          className="conversation-gear"
          onClick={showPopup}
          ref={popupAnchor}
          color={subColor}
          hoverColor={iconHoverColor}
          style={styles.icon}
        />
      )}
      {hasBadge ? <Kb.Box2 direction="horizontal" key="unreadDot" style={styles.unreadDotStyle} /> : null}
    </Kb.Box2>
  )
}

type BottomLineProps = {
  snippet?: string
  snippetDecoration?: T.RPCChat.SnippetDecoration
  backgroundColor?: string
  isSelected?: boolean
  allowBold?: boolean
}

const BottomLine = (p: BottomLineProps) => {
  const {allowBold = true, isSelected, backgroundColor} = p
  const snippet = p.snippet ?? ''
  const snippetDecoration = p.snippetDecoration ?? T.RPCChat.SnippetDecoration.none

  const you = useCurrentUserState(s => s.username)
  const {
    hasUnread,
    draft: _draft,
    hasResetUsers,
    participantNeedToRekey,
    youAreReset,
    youNeedToRekey,
    trustedState,
    hasId,
  } = Chat.useChatContext(
    C.useShallow(s => {
      const {membershipType, rekeyers, resetParticipants, trustedState} = s.meta
      return {
        draft: s.meta.draft,
        hasId: !!s.id,
        hasResetUsers: resetParticipants.size > 0,
        hasUnread: s.unread > 0,
        participantNeedToRekey: rekeyers.size > 0,
        trustedState,
        youAreReset: membershipType === 'youAreReset',
        youNeedToRekey: rekeyers.has(you),
      }
    })
  )

  const isDecryptingSnippet =
    hasId && !snippet ? trustedState === 'requesting' || trustedState === 'untrusted' : false
  const draft = (!isSelected && !hasUnread && _draft) || ''

  const subColor = isSelected
    ? Kb.Styles.globalColors.white
    : hasUnread
      ? Kb.Styles.globalColors.black
      : Kb.Styles.globalColors.black_50
  const showBold = allowBold && !isSelected && hasUnread
  const style = Kb.Styles.collapseStyles([
    styles.bottomLine,
    {color: subColor, ...(showBold ? Kb.Styles.globalStyles.fontBold : {})},
  ])

  let content: React.ReactNode
  if (youNeedToRekey) {
    content = null
  } else if (youAreReset) {
    content = (
      <Kb.Text
        type="BodySmallSemibold"
        fixOverdraw={Kb.Styles.isPhone}
        negative={true}
        style={Kb.Styles.collapseStyles([
          styles.youAreResetText,
          {color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.red},
        ])}
      >
        You are locked out.
      </Kb.Text>
    )
  } else if (participantNeedToRekey) {
    content = (
      <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Kb.Styles.globalColors.red} />
    )
  } else if (draft) {
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        <Kb.Text2
          type="BodySmall"
          style={Kb.Styles.collapseStyles([
            styles.draftLabel,
            isSelected ? {color: Kb.Styles.globalColors.white} : null,
          ])}
        >
          Draft:
        </Kb.Text2>
        <Kb.Markdown preview={true} style={style}>
          {draft}
        </Kb.Markdown>
      </Kb.Box2>
    )
  } else if (isDecryptingSnippet) {
    content = (
      <Kb.Meta title="decrypting..." style={styles.alertMeta} backgroundColor={Kb.Styles.globalColors.blue} />
    )
  } else {
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        <SnippetContent snippet={snippet} snippetDecoration={snippetDecoration} isSelected={isSelected} style={style} />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" style={styles.bottom} fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={Kb.Styles.isMobile ? {backgroundColor} : undefined}>
        {hasResetUsers && (
          <Kb.Meta title="reset" style={styles.alertMeta} backgroundColor={Kb.Styles.globalColors.red} />
        )}
        {youNeedToRekey && (
          <Kb.Meta
            title="rekey needed"
            style={styles.alertMeta}
            backgroundColor={Kb.Styles.globalColors.red}
          />
        )}
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.innerBox}>{content}</Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const SnippetContent = (p: {
  snippet: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  isSelected?: boolean
  style: Kb.Styles.StylesCrossPlatform
}) => {
  const {snippet, snippetDecoration: decoration, isSelected, style} = p
  const defaultIconColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_20

  let decorationNode: React.ReactNode
  let exploded = false
  let tooltip: string | undefined

  switch (decoration) {
    case T.RPCChat.SnippetDecoration.pendingMessage:
      tooltip = 'Sending\u2026'
      decorationNode = <SnippetDecorationIcon type="iconfont-hourglass" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.failedPendingMessage:
      tooltip = 'Failed to send'
      decorationNode = (
        <SnippetDecorationIcon
          type="iconfont-exclamation"
          color={isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.red}
        />
      )
      break
    case T.RPCChat.SnippetDecoration.explodingMessage:
      decorationNode = <SnippetDecorationIcon type="iconfont-timer-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.explodedMessage:
      decorationNode = (
        <Kb.Text
          type="BodySmall"
          style={{color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_50}}
        >
          Message exploded.
        </Kb.Text>
      )
      exploded = true
      break
    case T.RPCChat.SnippetDecoration.audioAttachment:
      decorationNode = <SnippetDecorationIcon type="iconfont-mic-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.videoAttachment:
      decorationNode = <SnippetDecorationIcon type="iconfont-film-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.photoAttachment:
      decorationNode = <SnippetDecorationIcon type="iconfont-camera-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.fileAttachment:
      decorationNode = <SnippetDecorationIcon type="iconfont-file-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.stellarReceived:
      decorationNode = <SnippetDecorationIcon type="iconfont-stellar-request" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.stellarSent:
      decorationNode = <SnippetDecorationIcon type="iconfont-stellar-send" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.pinnedMessage:
      decorationNode = <SnippetDecorationIcon type="iconfont-pin-solid" color={defaultIconColor} />
      break
    default:
      decorationNode = null
  }

  return (
    <>
      {!!decorationNode && (
        <Kb.Box2 direction="vertical" centerChildren={true} tooltip={tooltip}>
          {decorationNode}
        </Kb.Box2>
      )}
      {!exploded && !!snippet && (
        <Kb.Markdown preview={true} style={style}>
          {snippet}
        </Kb.Markdown>
      )}
    </>
  )
}

const SnippetDecorationIcon = (p: {type: Kb.IconType; color: string}) => (
  <Kb.Icon
    color={p.color}
    type={p.type}
    fontSize={Kb.Styles.isMobile ? 16 : 12}
    style={styles.snippetDecoration}
  />
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      alertMeta: Kb.Styles.platformStyles({
        common: {alignSelf: 'center', marginRight: 6},
        isMobile: {marginTop: 2},
      }),
      bold: {...Kb.Styles.globalStyles.fontBold},
      bottom: {justifyContent: 'flex-start'},
      bottomLine: Kb.Styles.platformStyles({
        isElectron: {
          color: Kb.Styles.globalColors.black_50,
          display: 'block',
          minHeight: 16,
          overflow: 'hidden',
          paddingRight: 10,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        },
        isMobile: {
          color: Kb.Styles.globalColors.black_50,
          flex: 1,
          lineHeight: 19,
          paddingRight: 40,
        },
      }),
      container: {
        flexShrink: 0,
        height: RowSizes.smallRowHeight,
      },
      contentBox: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
        width: '100%',
      },
      conversationRow: {
        flexGrow: 1,
        height: '100%',
        justifyContent: 'center',
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      draftLabel: {color: Kb.Styles.globalColors.orange},
      fastBlank: Kb.Styles.platformStyles({
        isPhone: {backgroundColor: Kb.Styles.globalColors.fastBlank},
        isTablet: {backgroundColor: undefined},
      }),
      icon: {position: 'relative'} as const,
      innerBox: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          height: 17,
          position: 'relative',
        },
        isMobile: {height: 21},
      }),
      insideContainer: {
        flexGrow: 1,
        height: Kb.Styles.isMobile ? 21 : 17,
        position: 'relative',
      },
      name: {paddingRight: Kb.Styles.globalMargins.tiny},
      nameContainer: {
        ...Kb.Styles.globalStyles.fillAbsolute,
      },
      rowContainer: Kb.Styles.platformStyles({
        common: {
          height: '100%',
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
        isElectron: Kb.Styles.desktopStyles.clickable,
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      snippetDecoration: {alignSelf: 'flex-start'} as const,
      teamTextStyle: Kb.Styles.platformStyles({
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      timestamp: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.fastBlank,
          color: Kb.Styles.globalColors.blueDark,
        },
        isTablet: {backgroundColor: undefined},
      }),
      unreadDotStyle: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderRadius: 6,
        height: 8,
        marginLeft: 4,
        width: 8,
      },
      withBottomLine: {
        justifyContent: 'flex-end',
        paddingBottom: Kb.Styles.globalMargins.xxtiny,
      },
      youAreResetText: Kb.Styles.platformStyles({
        isElectron: {fontSize: 12, lineHeight: 13},
        isMobile: {fontSize: 14, lineHeight: 19},
      }),
    }) as const
)

export {SmallTeam, BottomLine}
