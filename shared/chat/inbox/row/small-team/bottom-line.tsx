import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {SnippetContext, SnippetDecorationContext} from './contexts'

type Props = {
  layoutSnippet?: string
  backgroundColor?: string
  isSelected?: boolean
  isInWidget?: boolean
  allowBold?: boolean
}

const SnippetDecoration = (p: {type: Kb.IconType; color: string}) => {
  const {type, color} = p
  return (
    <Kb.Icon
      color={color}
      type={type}
      fontSize={Kb.Styles.isMobile ? 16 : 12}
      style={styles.snippetDecoration}
    />
  )
}

const Snippet = React.memo(function Snippet(p: {isSelected?: boolean; style: Kb.Styles.StylesCrossPlatform}) {
  const snippet = React.useContext(SnippetContext)
  const {isSelected, style} = p

  const decoration = React.useContext(SnippetDecorationContext)
  let snippetDecoration: React.ReactNode
  let exploded = false
  const defaultIconColor = isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_20
  let tooltip: string | undefined

  switch (decoration) {
    case T.RPCChat.SnippetDecoration.pendingMessage:
      tooltip = 'Sending…'
      snippetDecoration = <SnippetDecoration type="iconfont-hourglass" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.failedPendingMessage:
      tooltip = 'Failed to send'
      snippetDecoration = (
        <SnippetDecoration
          type="iconfont-exclamation"
          color={isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.red}
        />
      )
      break
    case T.RPCChat.SnippetDecoration.explodingMessage:
      snippetDecoration = <SnippetDecoration type="iconfont-timer-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.explodedMessage:
      snippetDecoration = (
        <Kb.Text
          type="BodySmall"
          style={{
            color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_50,
          }}
        >
          Message exploded.
        </Kb.Text>
      )
      exploded = true
      break
    case T.RPCChat.SnippetDecoration.audioAttachment:
      snippetDecoration = <SnippetDecoration type="iconfont-mic-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.videoAttachment:
      snippetDecoration = <SnippetDecoration type="iconfont-film-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.photoAttachment:
      snippetDecoration = <SnippetDecoration type="iconfont-camera-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.fileAttachment:
      snippetDecoration = <SnippetDecoration type="iconfont-file-solid" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.stellarReceived:
      snippetDecoration = <SnippetDecoration type="iconfont-stellar-request" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.stellarSent:
      snippetDecoration = <SnippetDecoration type="iconfont-stellar-send" color={defaultIconColor} />
      break
    case T.RPCChat.SnippetDecoration.pinnedMessage:
      snippetDecoration = <SnippetDecoration type="iconfont-pin-solid" color={defaultIconColor} />
      break
    default:
      snippetDecoration = null
  }
  return (
    <>
      {!!snippetDecoration && (
        <Kb.Box2 direction="vertical" centerChildren={true} tooltip={tooltip}>
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
  const {allowBold, isSelected, backgroundColor, isInWidget, layoutSnippet} = p

  const isTypingSnippet = C.useChatContext(s => {
    const typers = !isInWidget ? s.typing : undefined
    return !!typers?.size
  })

  const you = C.useCurrentUserState(s => s.username)
  const hasUnread = C.useChatContext(s => s.unread > 0)
  const _draft = C.useChatContext(s => s.meta.draft)
  const {hasResetUsers, isDecryptingSnippet, participantNeedToRekey, youAreReset, youNeedToRekey} =
    C.useChatContext(
      C.useShallow(s => {
        const {
          membershipType,
          rekeyers,
          resetParticipants,
          trustedState,
          conversationIDKey,
          snippetDecorated,
        } = s.meta
        const youAreReset = membershipType === 'youAreReset'
        const participantNeedToRekey = rekeyers.size > 0
        const youNeedToRekey = rekeyers.has(you)
        const hasResetUsers = resetParticipants.size > 0

        // only use layout if we don't have the meta at all
        const typers = !isInWidget ? s.typing : undefined
        const typingSnippet = (typers?.size ?? 0) > 0 ? 't' : undefined
        const maybeLayoutSnippet =
          conversationIDKey === C.Chat.noConversationIDKey ? layoutSnippet : undefined

        const snippet = typingSnippet ?? snippetDecorated ?? maybeLayoutSnippet ?? ''
        const isDecryptingSnippet =
          s.id && !snippet ? trustedState === 'requesting' || trustedState === 'untrusted' : false

        return {hasResetUsers, isDecryptingSnippet, participantNeedToRekey, youAreReset, youNeedToRekey}
      })
    )
  const draft = (!isSelected && !hasUnread && _draft) || ''

  const props = {
    allowBold,
    backgroundColor,
    draft,
    hasResetUsers,
    hasUnread,
    isDecryptingSnippet,
    isSelected,
    isTypingSnippet,
    participantNeedToRekey,
    youAreReset,
    youNeedToRekey,
  }

  return <BottomLineImpl {...props} />
})

type IProps = {
  allowBold?: boolean
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
  const {isDecryptingSnippet, draft, youAreReset, youNeedToRekey, isSelected, allowBold = true} = p
  const {isTypingSnippet, hasResetUsers, hasUnread, participantNeedToRekey, backgroundColor} = p

  const subColor = isSelected
    ? Kb.Styles.globalColors.white
    : hasUnread
      ? Kb.Styles.globalColors.black
      : Kb.Styles.globalColors.black_50
  const showBold = allowBold && !isSelected && hasUnread

  let content: React.ReactNode
  const style = React.useMemo(
    () =>
      Kb.Styles.collapseStyles([
        styles.bottomLine,
        {
          color: subColor,
          ...(showBold ? Kb.Styles.globalStyles.fontBold : {}),
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
        <Snippet isSelected={isSelected} style={style} />
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="vertical" style={styles.bottom} fullWidth={true}>
      <Kb.Box
        style={Kb.Styles.collapseStyles([
          styles.outerBox,
          {backgroundColor: Kb.Styles.isMobile ? backgroundColor : undefined},
        ])}
      >
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
        <Kb.Box style={styles.innerBox}>{content}</Kb.Box>
      </Kb.Box>
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      alertMeta: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'center',
          marginRight: 6,
        },
        isMobile: {marginTop: 2},
      }),
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
      contentBox: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
        width: '100%',
      },
      draftLabel: {color: Kb.Styles.globalColors.orange},
      innerBox: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          height: 17,
          position: 'relative',
        },
        isMobile: {height: 21},
      }),
      outerBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
      },
      snippetDecoration: {alignSelf: 'flex-start'},
      typingSnippet: {},
      youAreResetText: Kb.Styles.platformStyles({
        isElectron: {
          fontSize: 12,
          lineHeight: 13,
        },
        isMobile: {
          fontSize: 14,
          lineHeight: 19,
        },
      }),
    }) as const
)
export {BottomLine}
