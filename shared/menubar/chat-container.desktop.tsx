import * as React from 'react'
import * as C from '@/constants'
import * as R from '@/constants/remote'
import * as RemoteGen from '../actions/remote-gen'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import type {DeserializeProps} from './remote-serializer.desktop'
import {SmallTeam} from '../chat/inbox/row/small-team'

type RowProps = Pick<DeserializeProps, 'conversationsToSend'> & {
  conversationIDKey: T.Chat.ConversationIDKey
}

const RemoteSmallTeam = (props: RowProps) => {
  const {conversationsToSend, conversationIDKey} = props
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

const ChatPreview = (p: Pick<DeserializeProps, 'conversationsToSend'> & {convLimit?: number}) => {
  const {conversationsToSend, convLimit} = p
  const convRows = conversationsToSend
    .slice(0, convLimit ? convLimit : conversationsToSend.length)
    .map(c => c.conversationIDKey)

  const openInbox = React.useCallback(() => {
    R.remoteDispatch(RemoteGen.createShowMain())
    R.remoteDispatch(RemoteGen.createSwitchTab({tab: C.Tabs.chatTab}))
  }, [])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
      {convRows.map(id => (
        <C.ChatProvider key={id} id={id}>
          <RemoteSmallTeam conversationIDKey={id} conversationsToSend={conversationsToSend} />
        </C.ChatProvider>
      ))}
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonContainer}>
        <Kb.Button label="Open inbox" onClick={openInbox} small={true} mode="Secondary" />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonContainer: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  chatContainer: {
    backgroundColor: Kb.Styles.globalColors.white,
    color: Kb.Styles.globalColors.black,
  },
  toggleButton: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.black_05,
      borderRadius: Kb.Styles.borderRadius,
      marginBottom: Kb.Styles.globalMargins.xtiny,
      marginTop: Kb.Styles.globalMargins.xtiny,
      paddingBottom: Kb.Styles.globalMargins.xtiny,
      paddingTop: Kb.Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Kb.Styles.globalMargins.tiny,
      marginRight: Kb.Styles.globalMargins.tiny,
      paddingLeft: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.tiny,
    },
  }),
}))

export default ChatPreview
