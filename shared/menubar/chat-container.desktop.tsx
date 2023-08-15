import * as C from '../constants'
import * as R from '../constants/remote'
import * as RemoteGen from '../actions/remote-gen'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import type * as Types from '../constants/types/chat2'
import type {DeserializeProps} from './remote-serializer.desktop'
import {SmallTeam} from '../chat/inbox/row/small-team'

type RowProps = {
  conversationIDKey: Types.ConversationIDKey
}

const RemoteSmallTeam = (props: RowProps) => {
  const {conversationIDKey} = props
  const state = Container.useRemoteStore<DeserializeProps>()
  const {conversationsToSend} = state
  const conversation = conversationsToSend.find(c => c.conversationIDKey === conversationIDKey)
  const onSelectConversation = () => {
    R.remoteDispatch(RemoteGen.createOpenChatFromWidget({conversationIDKey}))
  }

  return (
    <SmallTeam
      onSelectConversation={onSelectConversation}
      conversationIDKey={conversationIDKey}
      isInWidget={true}
      isSelected={false}
      layoutIsTeam={conversation?.teamType !== 'adhoc'}
      layoutName={conversation?.tlfname}
      layoutSnippet={conversation?.snippetDecorated}
    />
  )
}

const ChatPreview = (p: {convLimit?: number}) => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const {convLimit} = p
  const {conversationsToSend} = state

  const convRows = conversationsToSend
    .slice(0, convLimit ? convLimit : conversationsToSend.length)
    .map(c => c.conversationIDKey)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
      {convRows.map(id => (
        <C.ChatProvider key={id} id={id}>
          <RemoteSmallTeam conversationIDKey={id} />
        </C.ChatProvider>
      ))}
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonContainer}>
        <Kb.Button
          label="Open inbox"
          onClick={() => R.remoteDispatch(RemoteGen.createOpenChatFromWidget({conversationIDKey: ''}))}
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
