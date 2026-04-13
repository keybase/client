import type * as React from 'react'
import type {ConversationIDKey} from '@/constants/types/chat'
import type {InboxSearchController} from './use-inbox-search'

type Props = {
  conversationIDKey?: ConversationIDKey
  search?: InboxSearchController
}

declare const Inbox: (p: Props) => React.ReactNode
export default Inbox
