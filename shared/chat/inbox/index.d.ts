import type * as React from 'react'
import type {ChatRootInboxRefresh, ConversationIDKey} from '@/constants/types/chat'
import type {InboxSearchController} from './use-inbox-search'

type Props = {
  conversationIDKey?: ConversationIDKey | undefined
  refreshInbox?: ChatRootInboxRefresh | undefined
  search?: InboxSearchController | undefined
}

declare const Inbox: (p: Props) => React.ReactNode
export default Inbox
