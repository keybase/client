import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RowSizes from './sizes'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/chat2'

type Props = {
  layoutChannelname: string
  conversationIDKey: Types.ConversationIDKey
  navKey: string
  selected: boolean
}

const BigTeamChannel = React.memo(function BigTeamChannel(props: Props) {
  const {conversationIDKey, selected, layoutChannelname} = props
  const dispatch = Container.useDispatch()
  const channelname =
    Container.useSelector(state => Constants.getMeta(state, conversationIDKey).channelname) ||
    layoutChannelname
  const isError = Container.useSelector(
    state => Constants.getMeta(state, conversationIDKey).trustedState === 'error'
  )
  const snippetDecoration = Container.useSelector(
    state => Constants.getMeta(state, conversationIDKey).snippetDecoration
  )
  const hasBadge = Container.useSelector(state => Constants.getHasBadge(state, conversationIDKey))
  const hasDraft = Container.useSelector(state => !selected && !!Constants.getDraft(state, conversationIDKey))
  const hasUnread = Container.useSelector(state => Constants.getHasUnread(state, conversationIDKey))
  const isMuted = Container.useSelector(state => Constants.isMuted(state, conversationIDKey))

  const onSelectConversation = () =>
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxBig'}))

  let outboxIcon: React.ReactNode = null
  switch (snippetDecoration) {
    case RPCChatTypes.SnippetDecoration.pendingMessage:
      outboxIcon = (
        <Kb.WithTooltip tooltip="Sending...">
          <Kb.Icon
            style={styles.icon}
            sizeType="Small"
            type={'iconfont-hourglass'}
            color={selected ? Styles.globalColors.white : Styles.globalColors.black_20}
          />
        </Kb.WithTooltip>
      )
      break
    case RPCChatTypes.SnippetDecoration.failedPendingMessage:
      outboxIcon = (
        <Kb.WithTooltip tooltip="Message failed to send">
          <Kb.Icon
            style={styles.icon}
            type={'iconfont-exclamation'}
            color={selected ? Styles.globalColors.white : Styles.globalColors.red}
          />
        </Kb.WithTooltip>
      )
      break
    default:
  }

  const nameStyle = Styles.collapseStyles([
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
    <Kb.Text
      lineClamp={1}
      type="Body"
      fixOverdraw={Styles.isPhone}
      style={Styles.collapseStyles([styles.channelHash, selected && styles.channelHashSelected])}
    >
      #{' '}
      <Kb.Text type={selected ? 'BodySemibold' : 'Body'} fixOverdraw={Styles.isPhone} style={nameStyle}>
        {channelname}
      </Kb.Text>
    </Kb.Text>
  )

  const mutedIcon = isMuted ? (
    <Kb.WithTooltip tooltip="Muted conversation">
      <Kb.Icon
        fixOverdraw={Styles.isPhone}
        color={selected ? Styles.globalColors.white : Styles.globalColors.black_20}
        style={styles.muted}
        type={Styles.isPhone ? (selected ? 'icon-shh-active-26-21' : 'icon-shh-26-21') : 'iconfont-shh'}
      />
    </Kb.WithTooltip>
  ) : null

  const draftIcon = hasDraft ? (
    <Kb.WithTooltip tooltip="Draft message">
      <Kb.Icon
        type="iconfont-edit"
        style={styles.icon}
        sizeType="Small"
        color={selected ? Styles.globalColors.white : undefined}
      />
    </Kb.WithTooltip>
  ) : null

  return (
    <Kb.ClickableBox onClick={onSelectConversation} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.rowContainer}>
        <Kb.Box2
          className="hover_background_color_blueGreyDark"
          direction="horizontal"
          fullWidth={!Styles.isMobile}
          style={Styles.collapseStyles([
            styles.channelBackground,
            selected && styles.selectedChannelBackground,
          ])}
        >
          {name}
          {mutedIcon}
          <Kb.Box style={styles.iconContainer}>
            {draftIcon}
            {outboxIcon}
            {hasBadge && <Kb.Box style={styles.unread} />}
          </Kb.Box>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  channelBackground: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: Styles.globalMargins.large,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isElectron: {
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      paddingLeft: Styles.globalMargins.tiny,
    },
    isPhone: {
      ...Styles.globalStyles.fillAbsolute,
      flex: 1,
      paddingLeft: Styles.globalMargins.small,
    },
    isTablet: {
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      flex: 1,
      height: '80%',
      marginLeft: 48,
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  channelHash: {color: Styles.globalColors.black_20},
  channelHashSelected: {color: Styles.globalColors.white_60},
  channelText: Styles.platformStyles({
    isElectron: {wordBreak: 'break-all'},
  }),
  container: {flexShrink: 0, height: RowSizes.bigRowHeight},
  icon: {margin: 3},
  iconContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'flex-end',
  },
  muted: {marginLeft: Styles.globalMargins.xtiny},
  rowContainer: Styles.platformStyles({
    common: {
      alignItems: 'stretch',
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: 0,
    },
    isElectron: Styles.desktopStyles.clickable,
    isTablet: {alignItems: 'center'},
  }),
  selectedChannelBackground: {backgroundColor: Styles.globalColors.blue},
  textError: {color: Styles.globalColors.redDark},
  textPlain: Styles.platformStyles({
    common: {color: Styles.globalColors.black_63},
    isPhone: {backgroundColor: Styles.globalColors.fastBlank},
  }),
  textPlainBold: Styles.platformStyles({
    common: {
      color: Styles.globalColors.blackOrWhite,
      ...Styles.globalStyles.fontBold,
    },
    isPhone: {backgroundColor: Styles.globalColors.fastBlank},
  }),
  textSelected: {color: Styles.globalColors.white},
  textSelectedBold: {
    color: Styles.globalColors.white,
    ...Styles.globalStyles.fontBold,
  },
  unread: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.orange,
      borderRadius: Styles.borderRadius,
      flexShrink: 0,
      height: 8,
      width: 8,
    },
    isMobile: {
      marginRight: Styles.globalMargins.tiny,
    },
  }),
}))

export default BigTeamChannel
