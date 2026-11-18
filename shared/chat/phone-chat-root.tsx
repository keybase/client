import * as Chat from '@/constants/chat'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'
import Inbox from '@/chat/inbox'
import InboxAndConversation, {type ChatRootRouteParams} from '@/chat/inbox-and-conversation'
import {narrowOptions, splitOptions} from '@/chat/phone-chat-root-options'

// An iPhone's chat tab root: the inbox, or the inbox and conversation side by side while the window
// is wide enough (see constants/chat/layout)
export default function PhoneChatRoot(props: ChatRootRouteParams) {
  const split = Chat.useIsChatSplit()
  const navigation = useNavigation()
  React.useLayoutEffect(() => {
    navigation.setOptions(split ? splitOptions : narrowOptions)
  }, [navigation, split])
  return split ? (
    <InboxAndConversation {...props} />
  ) : (
    <Inbox conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} />
  )
}
