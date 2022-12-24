import * as Chat2Gen from '../actions/chat2-gen'
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

  return (
    <SmallTeam
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
  const dispatch = Container.useDispatch()
  const {convLimit} = p
  const {conversationsToSend} = state

  const convRows = __STORYBOOK__
    ? []
    : conversationsToSend
        .slice(0, convLimit ? convLimit : conversationsToSend.length)
        .map(c => c.conversationIDKey)

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
