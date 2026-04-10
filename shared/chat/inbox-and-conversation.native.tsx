import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import useInboxHeaderPortal from './inbox/use-header-portal'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationNative(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const headerPortal = useInboxHeaderPortal(search)

  return (
    <>
      {headerPortal}
      <InboxAndConversationShell
        {...props}
        leftPane={<Inbox conversationIDKey={props.conversationIDKey} search={search} />}
      />
    </>
  )
}
