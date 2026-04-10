import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationNative(props: InboxAndConversationProps) {
  const search = useInboxSearch()

  return (
    <InboxAndConversationShell
      {...props}
      leftPane={<Inbox conversationIDKey={props.conversationIDKey} search={search} />}
    />
  )
}
