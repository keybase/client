import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'

export default function InboxAndConversationNative(props: InboxAndConversationProps) {
  return (
    <InboxAndConversationShell
      {...props}
      leftPane={<Inbox conversationIDKey={props.conversationIDKey} />}
    />
  )
}
