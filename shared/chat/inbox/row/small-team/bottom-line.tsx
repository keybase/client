import React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {AllowedColors} from '../../../../common-adapters/text'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type Props = {
  backgroundColor?: string
  participantNeedToRekey: boolean
  showBold: boolean
  snippet: string | null
  snippetDecoration: RPCChatTypes.SnippetDecoration
  subColor: AllowedColors
  youNeedToRekey: boolean
  youAreReset: boolean
  hasResetUsers: boolean
  isSelected: boolean
  isDecryptingSnippet: boolean
  isTypingSnippet: boolean
  draft?: string
}

const SnippetDecoration = (type: Kb.IconType, color: string, tooltip?: string) => {
  const icon = (
    <Kb.Icon
      color={color}
      type={type}
      fontSize={Styles.isMobile ? 16 : 12}
      style={{alignSelf: 'flex-start'}}
    />
  )
  return tooltip ? <Kb.WithTooltip tooltip={tooltip}>{icon}</Kb.WithTooltip> : icon
}

const BottomLine = React.memo((props: Props) => {
  let content: React.ReactNode
  const style = Styles.collapseStyles([
    styles.bottomLine,
    {
      color: props.subColor,
      ...(props.showBold ? Styles.globalStyles.fontBold : {}),
    },
    props.isTypingSnippet ? styles.typingSnippet : null,
  ])
  if (props.youNeedToRekey) {
    content = null
  } else if (props.youAreReset) {
    content = (
      <Kb.Text
        type="BodySmallSemibold"
        negative={true}
        style={Styles.collapseStyles([
          styles.youAreResetText,
          {
            color: props.isSelected ? Styles.globalColors.white : Styles.globalColors.red,
          },
        ])}
      >
        You are locked out.
      </Kb.Text>
    )
  } else if (props.participantNeedToRekey) {
    content = (
      <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
    )
  } else if (props.draft) {
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        <Kb.Text
          type="BodySmall"
          style={Styles.collapseStyles([
            styles.draftLabel,
            props.isSelected ? {color: Styles.globalColors.white} : null,
          ])}
        >
          Draft:
        </Kb.Text>
        <Kb.Markdown preview={true} style={style}>
          {props.draft}
        </Kb.Markdown>
      </Kb.Box2>
    )
  } else if (props.isDecryptingSnippet) {
    content = (
      <Kb.Meta title="decrypting..." style={styles.alertMeta} backgroundColor={Styles.globalColors.blue} />
    )
  } else if (props.snippet) {
    let snippetDecoration: React.ReactNode
    let exploded = false
    const defaultIconColor = props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_20

    switch (props.snippetDecoration) {
      case RPCChatTypes.SnippetDecoration.pendingMessage:
        snippetDecoration = SnippetDecoration('iconfont-hourglass', defaultIconColor, 'Sending…')
        break
      case RPCChatTypes.SnippetDecoration.failedPendingMessage:
        snippetDecoration = SnippetDecoration(
          'iconfont-exclamation',
          props.isSelected ? Styles.globalColors.white : Styles.globalColors.red,
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
              color: props.isSelected ? Styles.globalColors.white : Styles.globalColors.black_50,
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
    content = (
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.contentBox}>
        {!!snippetDecoration && (
          <Kb.Box2 direction="vertical" centerChildren={true}>
            {snippetDecoration}
          </Kb.Box2>
        )}
        {!exploded && !!props.snippet && (
          <Kb.Markdown preview={true} style={style}>
            {props.snippet}
          </Kb.Markdown>
        )}
      </Kb.Box2>
    )
  } else {
    return null
  }
  return (
    <Kb.Box
      style={Styles.collapseStyles([
        styles.outerBox,
        {
          backgroundColor: Styles.isMobile ? props.backgroundColor : undefined,
        },
      ])}
    >
      {props.hasResetUsers && (
        <Kb.Meta title="reset" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
      )}
      {props.youNeedToRekey && (
        <Kb.Meta title="rekey needed" style={styles.alertMeta} backgroundColor={Styles.globalColors.red} />
      )}
      <Kb.Box style={styles.innerBox}>{content}</Kb.Box>
    </Kb.Box>
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
        isMobile: {
          marginTop: 2,
        },
      }),
      bottomLine: Styles.platformStyles({
        isAndroid: {
          lineHeight: undefined,
        },
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
      draftLabel: {
        color: Styles.globalColors.orange,
      },
      innerBox: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          height: 17,
          position: 'relative',
        },
        isMobile: {
          height: 21,
        },
      }),
      outerBox: {
        ...Styles.globalStyles.flexBoxRow,
      },
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
