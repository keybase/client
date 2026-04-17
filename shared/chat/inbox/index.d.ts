import type * as React from 'react'
import type {ChatRootInboxRefresh, ConversationIDKey} from '@/constants/types/chat'
import type {InboxSearchController} from './use-inbox-search'

type Props = {
  conversationIDKey?: ConversationIDKey
  refreshInbox?: ChatRootInboxRefresh
  search?: InboxSearchController
}

declare const Inbox: (p: Props) => React.ReactNode
export default Inbox
