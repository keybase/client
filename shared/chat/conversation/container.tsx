import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import Normal from '@/chat/conversation/normal/container'
import NoConversation from '@/chat/conversation/no-conversation'
import Error from '@/chat/conversation/error'
import YouAreReset from '@/chat/conversation/you-are-reset'
import Rekey from '@/chat/conversation/rekey/container'
import type {ThreadSearchRouteProps} from '@/chat/conversation/thread-search-route'
import type * as T from '@/constants/types'
import {LiveConversationThreadProvider, useConversationThreadID, useConversationThreadSelector} from '@/chat/conversation/thread-context'

type Props = ThreadSearchRouteProps & {
  conversationIDKey?: T.Chat.ConversationIDKey
}

const Conversation = function Conversation(props: Props) {
  const conversationIDKey = props.conversationIDKey ?? Chat.noConversationIDKey
  return (
    <LiveConversationThreadProvider key={conversationIDKey} id={conversationIDKey}>
      <ConversationInner />
    </LiveConversationThreadProvider>
  )
}

const ConversationInner = function ConversationInner() {
  const conversationIDKey = useConversationThreadID()
  const meta = useConversationThreadSelector(s => s.meta)
  const type = (() => {
    switch (conversationIDKey) {
      case Chat.noConversationIDKey:
        return 'noConvo'
      default:
        if (meta.membershipType === 'youAreReset') {
          return 'youAreReset'
        } else if (meta.rekeyers.size > 0) {
          return 'rekey'
        } else if (meta.trustedState === 'error') {
          return 'error'
        } else {
          return 'normal'
        }
    }
  })()
  switch (type) {
    case 'error':
      return <Error />
    case 'noConvo':
      // When navigating back to the inbox on mobile, we deselect
      // conversationIDKey by called mobileChangeSelection. This results in
      // the conversation view rendering "NoConversation" as it is
      // transitioning back the the inbox.
      // On android this is very noticeable because transitions fade between
      // screens, so "NoConversation" will appear on top of the inbox for
      // approximately 150ms.
      // On iOS it is less noticeable because screen transitions slide away to
      // the right, though it is visible for a small amount of time.
      // To solve this we render a blank screen on mobile conversation views with "noConvo"
      return C.isPhone ? <></> : <NoConversation />
    case 'normal':
      return <Normal />
    case 'youAreReset':
      return <YouAreReset />
    case 'rekey':
      return <Rekey />
    default:
      return <NoConversation />
  }
}

export default Conversation
