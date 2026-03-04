import type * as React from 'react'
import type {ConversationIDKey} from '@/constants/types/chat'

type Props = {conversationIDKey?: ConversationIDKey}

declare const Inbox: (p: Props) => React.ReactNode
export default Inbox
