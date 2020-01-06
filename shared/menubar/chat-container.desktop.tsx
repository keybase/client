import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as Types from '../constants/types/chat2'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import {SmallTeam} from '../chat/inbox/row/small-team'
import {DeserializeProps} from './remote-serializer.desktop'
import {remoteConnect} from '../util/container'

type OwnProps = {
  convLimit: number
}

type RowProps = {
  conversationIDKey: Types.ConversationIDKey
}

type ChatPreviewProps = {
  onViewAll: () => void
  convRows: Array<Types.ConversationIDKey>
}

const noop = () => {}

const RemoteSmallTeam = remoteConnect(
  (state: DeserializeProps) => {
    const {conversationsToSend, config} = state
    const {username} = config
    return {conversationsToSend, username}
  },
  (dispatch, {conversationIDKey}: RowProps) => ({
    onSelectConversation: () => dispatch(Chat2Gen.createOpenChatFromWidget({conversationIDKey})),
  }),
  (stateProps, dispatchProps, ownProps: RowProps) => {
    const {conversationsToSend, username} = stateProps
    const {hasBadge, hasUnread, conversation, participantInfo} = conversationsToSend.find(
      c => c.conversation.conversationIDKey === ownProps.conversationIDKey
    )!
    const styles = Constants.getRowStyles(false, hasUnread)
    const participantNeedToRekey = conversation.rekeyers.size > 0
    const youNeedToRekey = !!participantNeedToRekey && conversation.rekeyers.has(username)
    return {
      backgroundColor: Styles.globalColors.white,
      channelname: conversation.channelname,
      conversationIDKey: conversation.conversationIDKey,
      hasBadge,
      hasBottomLine: true,
      hasResetUsers: !!conversation.resetParticipants && conversation.resetParticipants.size > 0,
      hasUnread,
      iconHoverColor: styles.iconHoverColor,
      isDecryptingSnippet: false,
      isFinalized: !!conversation.wasFinalizedBy,
      isInWidget: true,
      isMuted: conversation.isMuted,
      isSelected: false,
      isTypingSnippet: false,
      layoutSnippetDecoration: RPCChatTypes.SnippetDecoration.none,
      onHideConversation: noop,
      onMuteConversation: noop,
      onSelectConversation: dispatchProps.onSelectConversation,
      participantNeedToRekey,
      participants: conversation.teamname ? [] : Constants.getRowParticipants(participantInfo, username),
      showBold: styles.showBold,
      snippet: conversation.snippet,
      snippetDecoration: conversation.snippetDecoration,
      subColor: styles.subColor,
      teamname: conversation.teamname,
      timestamp: Constants.timestampToString(conversation),
      usernameColor: styles.usernameColor,
      youAreReset: conversation.membershipType === 'youAreReset',
      youNeedToRekey,
    }
  }
)(SmallTeam)

export const ChatPreview = ({onViewAll, convRows}: ChatPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
    {convRows.map(id => (
      <RemoteSmallTeam key={id} conversationIDKey={id} />
    ))}
    <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonContainer}>
      <Kb.Button label="Open inbox" onClick={onViewAll} small={true} mode="Secondary" />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  buttonContainer: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  chatContainer: {
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
}))

export default remoteConnect(
  (state: DeserializeProps) => {
    const {conversationsToSend} = state
    return {conversationsToSend}
  },
  dispatch => ({
    onViewAll: () => dispatch(Chat2Gen.createOpenChatFromWidget({})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    convRows: __STORYBOOK__
      ? []
      : stateProps.conversationsToSend
          .slice(0, ownProps.convLimit ? ownProps.convLimit : stateProps.conversationsToSend.length)
          .map(c => c.conversation.conversationIDKey),
    onViewAll: dispatchProps.onViewAll,
  })
)(ChatPreview)
