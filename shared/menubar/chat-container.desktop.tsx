import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../styles'
import * as Types from '../constants/types/chat2'
import {DeserializeProps} from './remote-serializer.desktop'
import {SmallTeam} from '../chat/inbox/row/small-team'

type RowProps = {
  conversationIDKey: Types.ConversationIDKey
}

const noop = () => {}

const RemoteSmallTeam = (props: RowProps) => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()
  const {conversationIDKey} = props
  const {conversationsToSend, config} = state
  const {username} = config
  const {hasBadge, hasUnread, conversation, participantInfo} = conversationsToSend.find(
    c => c.conversation.conversationIDKey === conversationIDKey
  )!
  const styles = Constants.getRowStyles(false, hasUnread)
  const participantNeedToRekey = conversation.rekeyers.size > 0
  const youNeedToRekey = !!participantNeedToRekey && conversation.rekeyers.has(username)
  return (
    <SmallTeam
      backgroundColor={Styles.globalColors.white}
      channelname={conversation.channelname}
      conversationIDKey={conversationIDKey}
      hasBadge={hasBadge}
      hasBottomLine={true}
      hasResetUsers={!!conversation.resetParticipants && conversation.resetParticipants.size > 0}
      hasUnread={hasUnread}
      iconHoverColor={styles.iconHoverColor}
      isDecryptingSnippet={false}
      isFinalized={!!conversation.wasFinalizedBy}
      isInWidget={true}
      isMuted={conversation.isMuted}
      isSelected={false}
      isTypingSnippet={false}
      layoutSnippetDecoration={RPCChatTypes.SnippetDecoration.none}
      onHideConversation={noop}
      onMuteConversation={noop}
      onSelectConversation={() => dispatch(Chat2Gen.createOpenChatFromWidget({conversationIDKey}))}
      participantNeedToRekey={participantNeedToRekey}
      participants={conversation.teamname ? [] : Constants.getRowParticipants(participantInfo, username)}
      showBold={styles.showBold}
      snippet={conversation.snippet}
      snippetDecoration={conversation.snippetDecoration}
      subColor={styles.subColor}
      teamname={conversation.teamname}
      timestamp={Constants.timestampToString(conversation)}
      usernameColor={styles.usernameColor}
      youAreReset={conversation.membershipType === 'youAreReset'}
      youNeedToRekey={youNeedToRekey}
    />
  )
}

const ChatPreview = (p: {convLimit?: number}) => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()
  const {convLimit} = p
  const {conversationsToSend} = state

  const convRows = __STORYBOOK__
    ? []
    : conversationsToSend
        .slice(0, convLimit ? convLimit : conversationsToSend.length)
        .map(c => c.conversation.conversationIDKey)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
      {convRows.map(id => (
        <RemoteSmallTeam key={id} conversationIDKey={id} />
      ))}
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonContainer}>
        <Kb.Button
          label="Open inbox"
          onClick={() => dispatch(Chat2Gen.createOpenChatFromWidget({}))}
          small={true}
          mode="Secondary"
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

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

export default ChatPreview
