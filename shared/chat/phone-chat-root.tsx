import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Inbox from '@/chat/inbox'
import InboxAndConversation, {type ChatRootRouteParams} from '@/chat/inbox-and-conversation'
import InboxAndConvoHeader from '@/chat/inbox-and-conversation-header'
import {narrowOptions, splitOptions} from '@/chat/phone-chat-root-options'

// An iPhone's chat tab root: the inbox, or the inbox and conversation side by side while the window
// is wide enough (see constants/chat/layout). Split, it draws the header itself (see
// phone-chat-root-options), clear of the status bar and of an iPhone Duo's status column.
export default function PhoneChatRoot(props: ChatRootRouteParams) {
  const styles = useStyles()
  const split = Chat.useIsChatSplit()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  React.useLayoutEffect(() => {
    navigation.setOptions(split ? splitOptions : narrowOptions)
  }, [navigation, split])
  if (!split) {
    return <Inbox conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} />
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          styles.header,
          {paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top},
        ])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerRow}>
          <InboxAndConvoHeader />
        </Kb.Box2>
      </Kb.Box2>
      <InboxAndConversation {...props} />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  header: {
    backgroundColor: theme.white,
    borderBottomColor: theme.black_10,
    borderBottomWidth: Kb.Styles.hairlineWidth,
  },
  headerRow: {height: 48},
}))
