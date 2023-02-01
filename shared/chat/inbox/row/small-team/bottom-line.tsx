import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import shallowEqual from 'shallowequal'
import {ConversationIDKeyContext, SnippetContext} from './contexts'

type Props = {
  isDecryptingSnippet: boolean
  backgroundColor?: string
  isSelected?: boolean
  isInWidget?: boolean
}

const SnippetDecoration = (type: Kb.IconType, color: string, tooltip?: string) => {
  const icon = (
    <Kb.Icon
      color={color}
      type={type}
      fontSize={Styles.isMobile ? 16 : 12}
      style={styles.snippetDecoration}
    />
  )
  return tooltip ? <Kb.WithTooltip tooltip={tooltip}>{icon}</Kb.WithTooltip> : icon
}

const Snippet = React.memo(function Snippet(p: {isSelected?: Boolean; style: Styles.StylesCrossPlatform}) {
  const snippet = React.useContext(SnippetContext)
  const {isSelected, style} = p
  let snippetDecoration: React.ReactNode
  let exploded = false
  const defaultIconColor = isSelected ? Styles.globalColors.white : Styles.globalColors.black_20

  switch (snippetDecoration) {
    case RPCChatTypes.SnippetDecoration.pendingMessage:
      snippetDecoration = SnippetDecoration('iconfont-hourglass', defaultIconColor, 'Sending…')
      break
    case RPCChatTypes.SnippetDecoration.failedPendingMessage:
      snippetDecoration = SnippetDecoration(
        'iconfont-exclamation',
        isSelected ? Styles.globalColors.white : Styles.globalColors.red,
        'Failed to send'
      )
      break
    case RPCChatTypes.SnippetDecoration.explodingMessage:
      snippetDecoration = SnippetDecoration('iconfont-timer-solid', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.explodedMessage:
      snippetDecoration = (
        <Kb.Text
          type="BodySmall"
          style={{
            color: isSelected ? Styles.globalColors.white : Styles.globalColors.black_50,
          }}
        >
          Message exploded.
        </Kb.Text>
      )
      exploded = true
      break
    case RPCChatTypes.SnippetDecoration.audioAttachment:
      snippetDecoration = SnippetDecoration('iconfont-mic-solid', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.videoAttachment:
      snippetDecoration = SnippetDecoration('iconfont-film-solid', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.photoAttachment:
      snippetDecoration = SnippetDecoration('iconfont-camera-solid', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.fileAttachment:
      snippetDecoration = SnippetDecoration('iconfont-file-solid', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.stellarReceived:
      snippetDecoration = SnippetDecoration('iconfont-stellar-request', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.stellarSent:
      snippetDecoration = SnippetDecoration('iconfont-stellar-send', defaultIconColor)
      break
    case RPCChatTypes.SnippetDecoration.pinnedMessage:
      snippetDecoration = SnippetDecoration('iconfont-pin-solid', defaultIconColor)
      break
    default:
      snippetDecoration = null
  }
  return (
    <>
      {!!snippetDecoration && (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          {snippetDecoration}
        </Kb.Box2>
      )}
      {!exploded && !!snippet && (
        <Kb.Markdown preview={true} style={style}>
          {snippet}
        </Kb.Markdown>
      )}
    </>
  )
})

const BottomLine = React.memo(function BottomLine(p: Props) {
  const conversationIDKey = React.useContext(ConversationIDKeyContext)
  const {isSelected, backgroundColor, isInWidget, isDecryptingSnippet} = p

  const data = Container.useSelector(state => {
    const meta = state.chat2.metaMap.get(conversationIDKey)
    const hasUnread = (state.chat2.unreadMap.get(conversationIDKey) ?? 0) > 0
    const youAreReset = meta?.membershipType === 'youAreReset'
    const participantNeedToRekey = (meta?.rekeyers?.size ?? 0) > 0
    const youNeedToRekey = meta?.rekeyers?.has(state.config.username) ?? false
    const hasResetUsers = (meta?.resetParticipants.size ?? 0) > 0
    const draft = (!isSelected && !hasUnread && state.chat2.draftMap.get(conversationIDKey)) || ''

    let isTypingSnippet = false
    if (!isInWidget) {
      const typers = state.chat2.typingMap.get(conversationIDKey)
      if (typers?.size) {
        isTypingSnippet = true
      }
    }

    return {
      draft,
      hasResetUsers,
      hasUnread,
      isTypingSnippet,
      participantNeedToRekey,
      youAreReset,
      youNeedToRekey,
    }
  }, shallowEqual)

  const props = {
    ...data,
    backgroundColor,
    isDecryptingSnippet,
    isSelected,
  }

  return <BottomLineImpl {...props} />
})

type IProps = {
  backgroundColor?: string
  draft: string
  hasResetUsers: boolean
  hasUnread: boolean
  isDecryptingSnippet: boolean
  isTypingSnippet: boolean
  participantNeedToRekey: boolean
  youAreReset: boolean
  youNeedToRekey: boolean
  isSelected?: boolean
}
const BottomLineImpl = React.memo(function BottomLineImpl(p: IProps) {
  const {isDecryptingSnippet, draft, youAreReset, youNeedToRekey, isSelected} = p
  const {isTypingSnippet, hasResetUsers, hasUnread, participantNeedToRekey, backgroundColor} = p

  const subColor = isSelected
    ? Styles.globalColors.white
    : hasUnread
    ? Styles.globalColors.black
    : Styles.globalColors.black_50
  const showBold = !isSelected && hasUnread

  let content: React.ReactNode
  const style = React.useMemo(
    () =>
      Styles.collapseStyles([
        styles.bottomLine,
        {
          color: subColor,
          ...(showBold ? Styles.globalStyles.fontBold : {}),
        },
        isTypingSnippet ? styles.typingSnippet : null,
      ]),
    [isTypingSnippet, showBold, subColor]
  )
  if (youNeedToRekey) {
    content = null
  } else if (youAreReset) {
    content = (
      <Kb.Text
        type="BodySmallSemibold"
        fixOverdraw={Styles.isPhone}
        negative={true}
        style={Styles.collapseStyles([
          styles.youAreResetText,
          {color: isSelected ? Styles.globalColors.white : Styles.globalColors.red},
        ])}
      >
        You are locked out.
      </Kb.Text>
    )
  } else if (participantNeedToRekey) {
    content = (
      <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
    )
  } else if (draft) {
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        <Kb.Text
          type="BodySmall"
          style={Styles.collapseStyles([
            styles.draftLabel,
            isSelected ? {color: Styles.globalColors.white} : null,
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
      <Kb.Meta title="decrypting..." style={styles.alertMeta} backgroundColor={Styles.globalColors.blue} />
    )
  } else {
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        <Snippet isSelected={isSelected} style={style} />
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="vertical" style={styles.bottom} fullWidth={true}>
      <Kb.Box
        style={Styles.collapseStyles([
          styles.outerBox,
          {backgroundColor: Styles.isMobile ? backgroundColor : undefined},
        ])}
      >
        {hasResetUsers && (
          <Kb.Meta title="reset" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
        )}
        {youNeedToRekey && (
          <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
        )}
        <Kb.Box style={styles.innerBox}>{content}</Kb.Box>
      </Kb.Box>
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alertMeta: Styles.platformStyles({
        common: {
          alignSelf: 'center',
          marginRight: 6,
        },
        isMobile: {marginTop: 2},
      }),
      bottom: {justifyContent: 'flex-start'},
      bottomLine: Styles.platformStyles({
        isAndroid: {lineHeight: undefined},
        isElectron: {
          color: Styles.globalColors.black_50,
          display: 'block',
          minHeight: 16,
          overflow: 'hidden',
          paddingRight: 10,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        },
        isMobile: {
          color: Styles.globalColors.black_50,
          flex: 1,
          fontSize: 15,
          lineHeight: 19,
          paddingRight: 40,
          paddingTop: 2, // so the tops of emoji aren't chopped off
        },
      }),
      contentBox: {
        ...Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
        width: '100%',
      },
      draftLabel: {color: Styles.globalColors.orange},
      innerBox: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          height: 17,
          position: 'relative',
        },
        isMobile: {height: 21},
      }),
      outerBox: {
        ...Styles.globalStyles.flexBoxRow,
      },
      snippetDecoration: {alignSelf: 'flex-start'},
      typingSnippet: {},
      youAreResetText: Styles.platformStyles({
        isElectron: {
          fontSize: 12,
          lineHeight: 13,
        },
        isMobile: {
          fontSize: 14,
          lineHeight: 19,
        },
      }),
    } as const)
)
export {BottomLine}
