import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationDesktop(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const leftPane = <Inbox conversationIDKey={props.conversationIDKey} search={search} />

  return <InboxAndConversationShell {...props} leftPane={leftPane} />
}
