import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RowSizes from './sizes'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'

type Props = {
  channelname: string
  conversationIDKey: Types.ConversationIDKey
  navKey: string
  selected: boolean
}

const BigTeamChannel = (props: Props) => {
  const {conversationIDKey, selected} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const hasBadge = Container.useSelector(state => Constants.getHasBadge(state, conversationIDKey))
  const getDraft = Container.useSelector(state => !!Constants.getDraft(state, conversationIDKey))
  const hasUnread = Container.useSelector(state => Constants.getHasUnread(state, conversationIDKey))
  const isMuted = Container.useSelector(state => Constants.isMuted(state, conversationIDKey))
  const isSelected = selected

  const onSelectConversation = () =>
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxBig'}))

  const channelname = meta.channelname || props.channelname
  const hasDraft = getDraft && !isSelected
  const isError = meta.trustedState === 'error'
  const snippetDecoration = meta.snippetDecoration

  let outboxIcon: React.ReactNode = null
  switch (snippetDecoration) {
    case RPCChatTypes.SnippetDecoration.pendingMessage:
      outboxIcon = (
        <Kb.WithTooltip tooltip="Sending...">
          <Kb.Icon
            style={styles.icon}
            sizeType="Small"
            type={'iconfont-hourglass'}
            color={isSelected ? Styles.globalColors.white : Styles.globalColors.black_20}
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
            color={isSelected ? Styles.globalColors.white : Styles.globalColors.red}
          />
        </Kb.WithTooltip>
      )
      break
  }

  return (
    <Kb.ClickableBox onClick={onSelectConversation} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.rowContainer}>
        <Kb.Box2
          className="hover_background_color_blueGreyDark"
          direction="horizontal"
          fullWidth={!Styles.isMobile}
          style={Styles.collapseStyles([
            styles.channelBackground,
            isSelected && styles.selectedChannelBackground,
          ])}
        >
          <Kb.Text
            lineClamp={1}
            type="Body"
            style={Styles.collapseStyles([styles.channelHash, isSelected && styles.channelHashSelected])}
          >
            #{' '}
            <Kb.Text
              type={isSelected ? 'BodySemibold' : 'Body'}
              style={Styles.collapseStyles([
                styles.channelText,
                isError
                  ? styles.textError
                  : isSelected
                  ? hasUnread
                    ? styles.textSelectedBold
                    : styles.textSelected
                  : hasUnread
                  ? styles.textPlainBold
                  : styles.textPlain,
              ])}
            >
              {channelname}
            </Kb.Text>
          </Kb.Text>
          {isMuted && (
            <Kb.WithTooltip tooltip="Muted conversation">
              <Kb.Icon
                color={isSelected ? Styles.globalColors.white : Styles.globalColors.black_20}
                style={styles.muted}
                type={
                  Styles.isPhone ? (isSelected ? 'icon-shh-active-26-21' : 'icon-shh-26-21') : 'iconfont-shh'
                }
              />
            </Kb.WithTooltip>
          )}
          <Kb.Box style={styles.iconContainer}>
            {hasDraft && (
              <Kb.WithTooltip tooltip="Draft message">
                <Kb.Icon
                  type="iconfont-edit"
                  style={styles.icon}
                  sizeType="Small"
                  color={isSelected ? Styles.globalColors.white : undefined}
                />
              </Kb.WithTooltip>
            )}
            {outboxIcon}
            {hasBadge && <Kb.Box style={styles.unread} />}
          </Kb.Box>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

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

export default React.memo(BigTeamChannel)
