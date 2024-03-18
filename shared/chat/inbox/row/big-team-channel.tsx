import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RowSizes from './sizes'
import * as T from '@/constants/types'
import * as RPCChatTypes from '@/constants/types/rpc-chat-gen'

type Props = {
  layoutChannelname: string
  navKey: string
  selected: boolean
  layoutSnippetDecoration?: RPCChatTypes.SnippetDecoration
}

const BigTeamChannel = React.memo(function BigTeamChannel(props: Props) {
  const {selected, layoutChannelname, layoutSnippetDecoration} = props
  const channelname = C.useChatContext(s => s.meta.channelname || layoutChannelname)
  const isError = C.useChatContext(s => s.meta.trustedState === 'error')
  const snippetDecoration = C.useChatContext(s => {
    const d =
      s.meta.conversationIDKey === C.Chat.noConversationIDKey
        ? layoutSnippetDecoration ?? RPCChatTypes.SnippetDecoration.none
        : s.meta.snippetDecoration

    switch (d) {
      case T.RPCChat.SnippetDecoration.pendingMessage:
      case T.RPCChat.SnippetDecoration.failedPendingMessage:
        return d
      default:
        return 0
    }
  })
  const hasBadge = C.useChatContext(s => s.badge > 0)
  const hasDraft = C.useChatContext(s => !!s.meta.draft)
  const hasUnread = C.useChatContext(s => s.unread > 0)
  const isMuted = C.useChatContext(s => s.meta.isMuted)
  const navigateToThread = C.useChatContext(s => s.dispatch.navigateToThread)
  const onSelectConversation = () => navigateToThread('inboxBig')

  let outboxTooltip: string | undefined
  let outboxIcon: React.ReactNode = null
  switch (snippetDecoration) {
    case T.RPCChat.SnippetDecoration.pendingMessage:
      outboxTooltip = 'Sending...'
      outboxIcon = (
        <Kb.Icon
          style={styles.icon}
          sizeType="Small"
          type={'iconfont-hourglass'}
          color={selected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_20}
        />
      )
      break
    case T.RPCChat.SnippetDecoration.failedPendingMessage:
      outboxTooltip = 'Message failed to send'
      outboxIcon = (
        <Kb.Icon
          style={styles.icon}
          type={'iconfont-exclamation'}
          color={selected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.red}
        />
      )
      break
    default:
  }

  const nameStyle = Kb.Styles.collapseStyles([
    styles.channelText,
    isError
      ? styles.textError
      : selected
        ? hasUnread
          ? (styles.textSelectedBold as any)
          : styles.textSelected
        : hasUnread
          ? styles.textPlainBold
          : (styles.textPlain as any),
  ] as any)

  const name = (
    <Kb.Text2
      lineClamp={1}
      type="Body"
      style={Kb.Styles.collapseStyles([styles.channelHash, selected && styles.channelHashSelected])}
    >
      #{' '}
      <Kb.Text2 type={selected ? 'BodySemibold' : 'Body'} style={nameStyle}>
        {channelname}
      </Kb.Text2>
    </Kb.Text2>
  )

  const mutedIcon = isMuted ? (
    <Kb.Box2 direction="vertical" tooltip="Muted conversation">
      <Kb.Icon
        fixOverdraw={Kb.Styles.isPhone}
        color={selected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_20}
        style={styles.muted}
        type={Kb.Styles.isPhone ? (selected ? 'icon-shh-active-26-21' : 'icon-shh-26-21') : 'iconfont-shh'}
      />
    </Kb.Box2>
  ) : null

  const draftIcon = hasDraft ? (
    <Kb.Icon
      type="iconfont-edit"
      style={styles.icon}
      sizeType="Small"
      color={selected ? Kb.Styles.globalColors.white : undefined}
    />
  ) : null

  return (
    <Kb.ClickableBox onClick={onSelectConversation} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.rowContainer}>
        <Kb.Box2
          className="hover_background_color_blueGreyDark"
          direction="horizontal"
          fullWidth={!Kb.Styles.isMobile}
          style={Kb.Styles.collapseStyles([
            styles.channelBackground,
            selected && styles.selectedChannelBackground,
          ])}
        >
          {name}
          {mutedIcon}
          <Kb.Box2
            direction="horizontal"
            alignSelf="center"
            alignItems="center"
            style={styles.iconContainer}
            tooltip={outboxTooltip || hasDraft ? 'Draft message' : undefined}
          >
            {draftIcon}
            {outboxIcon}
            {hasBadge && <Kb.Box style={styles.unread} />}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  channelBackground: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: Kb.Styles.globalMargins.large,
      paddingRight: Kb.Styles.globalMargins.xsmall,
    },
    isElectron: {
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      paddingLeft: Kb.Styles.globalMargins.tiny,
    },
    isPhone: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      flex: 1,
      paddingLeft: Kb.Styles.globalMargins.small,
    },
    isTablet: {
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      flex: 1,
      height: '80%',
      marginLeft: 48,
      paddingLeft: Kb.Styles.globalMargins.tiny,
    },
  }),
  channelHash: {color: Kb.Styles.globalColors.black_20},
  channelHashSelected: {color: Kb.Styles.globalColors.white_60},
  channelText: Kb.Styles.platformStyles({
    isElectron: {wordBreak: 'break-all'},
  }),
  container: {flexShrink: 0, height: RowSizes.bigRowHeight},
  icon: {
    display: 'flex',
    margin: 3,
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  muted: {marginLeft: Kb.Styles.globalMargins.xtiny},
  rowContainer: Kb.Styles.platformStyles({
    common: {
      alignItems: 'stretch',
      paddingLeft: Kb.Styles.globalMargins.tiny,
      paddingRight: 0,
    },
    isElectron: Kb.Styles.desktopStyles.clickable,
    isTablet: {alignItems: 'center'},
  }),
  selectedChannelBackground: {backgroundColor: Kb.Styles.globalColors.blue},
  textError: {color: Kb.Styles.globalColors.redDark},
  textPlain: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.black_63},
    isPhone: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  }),
  textPlainBold: Kb.Styles.platformStyles({
    common: {
      color: Kb.Styles.globalColors.blackOrWhite,
      ...Kb.Styles.globalStyles.fontBold,
    },
    isPhone: {backgroundColor: Kb.Styles.globalColors.fastBlank},
  }),
  textSelected: {color: Kb.Styles.globalColors.white},
  textSelectedBold: {
    color: Kb.Styles.globalColors.white,
    ...Kb.Styles.globalStyles.fontBold,
  },
  unread: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.orange,
      borderRadius: Kb.Styles.borderRadius,
      flexShrink: 0,
      height: 8,
      width: 8,
    },
    isMobile: {
      marginRight: Kb.Styles.globalMargins.tiny,
    },
  }),
}))

export default BigTeamChannel
