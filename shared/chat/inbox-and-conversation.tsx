import * as C from '@/constants'
import Desktop from './inbox-and-conversation.desktop'
import Native from './inbox-and-conversation.native'

const InboxAndConversation = C.isMobile ? Native : Desktop

export default InboxAndConversation
export type {ChatRootRouteParams, InboxAndConversationProps} from './inbox-and-conversation-shared'
