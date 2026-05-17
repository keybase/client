import Inbox from '@/chat/inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from '@/chat/inbox-and-conversation-shared'
import useInboxHeaderPortal from '@/chat/inbox/use-header-portal'
import {useInboxSearch} from '@/chat/inbox/use-inbox-search'

export default function InboxAndConversationNative(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const headerPortal = useInboxHeaderPortal(search)

  return (
    <>
      {headerPortal}
      <InboxAndConversationShell
        {...props}
        leftPane={
          <Inbox conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} search={search} />
        }
      />
    </>
  )
}

export type {ChatRootRouteParams} from '@/chat/inbox-and-conversation-shared'
