import * as C from '@/constants'
import Desktop from './inbox-and-conversation.desktop'
import Native from './inbox-and-conversation.native'
import type {InboxAndConversationProps} from './inbox-and-conversation-shared'

function InboxAndConversation(props: InboxAndConversationProps) {
  return C.isMobile ? <Native {...props} /> : <Desktop {...props} />
}

export default InboxAndConversation
export type {ChatRootRouteParams, InboxAndConversationProps} from './inbox-and-conversation-shared'
