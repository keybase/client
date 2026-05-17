import * as C from '@/constants'
import Desktop from '@/chat/inbox-and-conversation.desktop'
import Native from '@/chat/inbox-and-conversation.native'
import type {InboxAndConversationProps} from '@/chat/inbox-and-conversation-shared'

function InboxAndConversation(props: InboxAndConversationProps) {
  return C.isMobile ? <Native {...props} /> : <Desktop {...props} />
}

export default InboxAndConversation
export type {ChatRootRouteParams, InboxAndConversationProps} from '@/chat/inbox-and-conversation-shared'
