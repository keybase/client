import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
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
import {useInboxRowSmall} from '@/stores/inbox-rows'
import TeamMenu from '@/chat/conversation/info-panel/menu'
export type Props = {
  conversationIDKey: string
  isSelected: boolean
  onSelectConversation?: (() => void) | undefined
}

const SmallTeam = (p: Props) => {
  const {conversationIDKey, isSelected} = p

  const row = useInboxRowSmall(conversationIDKey)
  const setOpenedRow = useOpenedRowState(s => s.dispatch.setOpenRow)

  const {isMuted, isLocked, draft: rawDraft, teamDisplayName, hasBadge, hasUnread} = row
  const {hasResetUsers, youNeedToRekey, youAreReset, participantNeedToRekey, participants} = row
  const {snippet, snippetDecoration, typingSnippet, timestamp, isDecryptingSnippet} = row
  const displaySnippet = typingSnippet || snippet
  const draft = (!isSelected && !hasUnread && rawDraft) || ''
  const onSelectConversation = isSelected
    ? undefined
    : (p.onSelectConversation ??
        (() => {
          setOpenedRow(Chat.noConversationIDKey)
          C.Router2.navigateToThread(conversationIDKey, 'inboxSmall')
        }))

  const backgroundColor = isSelected
    ? Kb.Styles.globalColors.blue
    : Kb.Styles.isPhone && !Kb.Styles.isTablet
      ? undefined
      : Kb.Styles.globalColors.blueGrey

  const participantOne = teamDisplayName ? '' : participants[0] ?? ''
  const participantTwo = teamDisplayName ? '' : participants[1] ?? ''
  const className = Kb.Styles.classNames('small-row', {selected: isSelected})
  const containerStyle = Kb.Styles.isTablet
    ? Kb.Styles.collapseStyles([styles.container, {backgroundColor}])
    : styles.container
  const rowContents = (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.rowContainer}>
      {teamDisplayName ? (
        <TeamAvatar teamname={teamDisplayName} isMuted={isMuted} isSelected={isSelected} isHovered={false} />
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
      <Kb.Box2 direction="vertical" style={styles.conversationRow}>
        <Kb.Box2 direction="vertical" justifyContent="flex-end" style={styles.withBottomLine} fullWidth={true}>
          <TopLine
            conversationIDKey={conversationIDKey}
            participants={participants}
            teamDisplayName={teamDisplayName}
            timestamp={timestamp}
            hasBadge={hasBadge}
            hasUnread={hasUnread}
            isSelected={isSelected}
            backgroundColor={backgroundColor}
          />
        </Kb.Box2>
        <BottomLineDisplay
          snippet={displaySnippet}
          snippetDecoration={snippetDecoration}
          backgroundColor={backgroundColor}
          isSelected={isSelected}
          hasUnread={hasUnread}
          draft={draft}
          hasResetUsers={hasResetUsers}
          youNeedToRekey={youNeedToRekey}
          youAreReset={youAreReset}
          participantNeedToRekey={participantNeedToRekey}
          isDecryptingSnippet={isDecryptingSnippet}
        />
      </Kb.Box2>
    </Kb.Box2>
  )

  return (
    <SwipeConvActions conversationIDKey={conversationIDKey} onPress={onSelectConversation}>
      {Kb.Styles.isMobile ? (
        <Kb.Box2 direction="vertical" style={containerStyle}>
          {rowContents}
        </Kb.Box2>
      ) : (
        <Kb.ClickableBox2
          {...(onSelectConversation === undefined ? {} : {onClick: onSelectConversation})}
          className={className}
          testID="inboxRow"
          style={containerStyle}
        >
          {rowContents}
        </Kb.ClickableBox2>
      )}
    </SwipeConvActions>
  )
}

type TopLineProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  participants: ReadonlyArray<string>
  teamDisplayName: string
  timestamp: number
  hasBadge: boolean
  hasUnread: boolean
  isSelected: boolean
  backgroundColor?: string | undefined
}

const TopLine = (p: TopLineProps) => {
  const {isSelected, backgroundColor, conversationIDKey, participants, teamDisplayName, timestamp, hasBadge, hasUnread} = p
  const showBold = !isSelected && hasUnread
  const subColor = isSelected
    ? Kb.Styles.globalColors.white
    : hasUnread
      ? Kb.Styles.globalColors.black
      : Kb.Styles.globalColors.black_50

  const tssubColor = (!hasBadge || isSelected) && subColor
  const timestampStyle = Kb.Styles.collapseStyles([
    showBold && styles.bold,
    styles.timestamp,
    tssubColor !== false && ({color: tssubColor} as Kb.Styles.StylesCrossPlatform),
  ])
  const timestampText = timestamp ? formatTimeForConversationList(timestamp) : ''

  const usernameColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black
  const nameContainerStyle = Kb.Styles.collapseStyles([
    styles.name,
    showBold && styles.bold,
    {color: usernameColor},
    Kb.Styles.isMobile && {backgroundColor},
  ])
  const teamContainerStyle = Kb.Styles.collapseStyles([
    styles.teamTextStyle,
    showBold && styles.bold,
    {color: usernameColor},
  ])

  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true}>
      <Kb.Box2 direction="horizontal" style={styles.insideContainer} relative={true}>
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.nameContainer}>
          {teamDisplayName ? (
            <Kb.Text type="BodySemibold" style={teamContainerStyle} lineClamp={1}>
              {teamDisplayName}
            </Kb.Text>
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
      <Kb.Text key="timestamp" type="BodyTiny" className="conversation-timestamp" style={timestampStyle}>
        {timestampText}
      </Kb.Text>
      {!Kb.Styles.isMobile && (
        <TopLineGear conversationIDKey={conversationIDKey} subColor={subColor} isSelected={isSelected} />
      )}
      {hasBadge ? <Kb.Box2 direction="horizontal" key="unreadDot" style={styles.unreadDotStyle} /> : null}
    </Kb.Box2>
  )
}

const TopLineGear = (p: {conversationIDKey: T.Chat.ConversationIDKey; subColor: string; isSelected: boolean}) => {
  const {conversationIDKey, subColor, isSelected} = p
  const iconHoverColor = isSelected ? Kb.Styles.globalColors.white_75 : Kb.Styles.globalColors.black
  const makePopup = (mp: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = mp
    return (
      <ConvoState.ChatProvider id={conversationIDKey}>
        <TeamMenu
          visible={true}
          {...(attachTo === undefined ? {} : {attachTo})}
          onHidden={hidePopup}
          hasHeader={true}
          isSmallTeam={true}
        />
      </ConvoState.ChatProvider>
    )
  }
  const {showingPopup, showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      {showingPopup && popup}
      <Kb.Box2 direction="vertical" ref={popupAnchor} style={styles.icon}>
        <Kb.Icon
          type="iconfont-gear"
          className="conversation-gear"
          onClick={showPopup}
          color={subColor}
          hoverColor={iconHoverColor}
        />
      </Kb.Box2>
    </>
  )
}

type BottomLineDisplayProps = {
  snippet: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  backgroundColor?: string | undefined
  isSelected?: boolean | undefined
  allowBold?: boolean | undefined
  hasUnread: boolean
  draft: string
  hasResetUsers: boolean
  youNeedToRekey: boolean
  youAreReset: boolean
  participantNeedToRekey: boolean
  isDecryptingSnippet: boolean
}

const BottomLineDisplay = (p: BottomLineDisplayProps) => {
  const {allowBold = true, isSelected, backgroundColor} = p
  const {snippet, snippetDecoration, hasUnread, draft} = p
  const {hasResetUsers, youNeedToRekey, youAreReset, participantNeedToRekey, isDecryptingSnippet} = p

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
        <Kb.Text
          type="BodySmall"
          style={Kb.Styles.collapseStyles([
            styles.draftLabel,
            isSelected ? {color: Kb.Styles.globalColors.white} : null,
          ])}
        >
          Draft:
        </Kb.Text>
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
  )
}

// Connected BottomLine that uses ChatContext (for external consumers like selectable-small-team)
type BottomLineProps = {
  snippet?: string | undefined
  snippetDecoration?: T.RPCChat.SnippetDecoration | undefined
  backgroundColor?: string | undefined
  isSelected?: boolean | undefined
  allowBold?: boolean | undefined
}

const BottomLine = (p: BottomLineProps) => {
  const {allowBold = true, isSelected, backgroundColor} = p
  const snippet = p.snippet ?? ''
  const snippetDecoration = p.snippetDecoration ?? T.RPCChat.SnippetDecoration.none

  const you = useCurrentUserState(s => s.username)
  const {hasUnread, draft: _draft, hasResetUsers, participantNeedToRekey, youAreReset, youNeedToRekey, trustedState, hasId} =
    ConvoState.useChatContext(
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

  const isDecryptingSnippet = hasId && !snippet ? trustedState === 'requesting' || trustedState === 'untrusted' : false
  const draft = (!isSelected && !hasUnread && _draft) || ''

  return (
    <BottomLineDisplay
      snippet={snippet}
      snippetDecoration={snippetDecoration}
      backgroundColor={backgroundColor}
      isSelected={isSelected}
      allowBold={allowBold}
      hasUnread={hasUnread}
      draft={draft}
      hasResetUsers={hasResetUsers}
      youNeedToRekey={youNeedToRekey}
      youAreReset={youAreReset}
      participantNeedToRekey={participantNeedToRekey}
      isDecryptingSnippet={isDecryptingSnippet}
    />
  )
}

const SnippetContent = (p: {
  snippet: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  isSelected?: boolean | undefined
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
        <Kb.Box2 direction="vertical" centerChildren={true} {...(tooltip === undefined ? {} : {tooltip})}>
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
      timestamp: {
        color: Kb.Styles.globalColors.blueDark,
      },
      unreadDotStyle: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderRadius: 6,
        height: 8,
        marginLeft: 4,
        width: 8,
      },
      withBottomLine: {
        paddingBottom: Kb.Styles.globalMargins.xxtiny,
      },
      youAreResetText: Kb.Styles.platformStyles({
        isElectron: {fontSize: 12, lineHeight: 13},
        isMobile: {fontSize: 14, lineHeight: 19},
      }),
    }) as const
)

export {SmallTeam, BottomLine}
