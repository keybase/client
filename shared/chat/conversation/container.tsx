import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import type {ThreadSearchRouteProps} from './thread-search-route'
import type * as T from '@/constants/types'
import {BadgeHeaderUpdater} from './header-area'
import {useConversationMetadataReload} from './data-hooks'
import {LiveConversationThreadProvider, useConversationThreadID, useThreadMeta} from './thread-context'

type Props = ThreadSearchRouteProps & {
  conversationIDKey?: T.Chat.ConversationIDKey
}

const Conversation = function Conversation(props: Props) {
  const conversationIDKey = props.conversationIDKey ?? Chat.noConversationIDKey
  // BadgeHeaderUpdater stays outside the keyed provider: the pendingWaiting →
  // real-conv switch is a setParams on this same screen, and the updater's
  // title-was-empty tracking must survive that switch to repaint the native
  // header (a remounted instance would see the title content as already
  // present and never fire).
  return (
    <>
      <BadgeHeaderUpdater conversationIDKey={conversationIDKey} />
      <LiveConversationThreadProvider key={conversationIDKey} id={conversationIDKey}>
        <ConversationInner />
      </LiveConversationThreadProvider>
    </>
  )
}

const ConversationInner = function ConversationInner() {
  const conversationIDKey = useConversationThreadID()
  // Single owner of the meta/participants reload listeners for this screen; the
  // header/banner/input consumers read via the reload-free selector hooks.
  useConversationMetadataReload(conversationIDKey)
  const meta = useThreadMeta(
    C.useShallow(m => ({
      membershipType: m.membershipType,
      rekeyers: m.rekeyers,
      trustedState: m.trustedState,
    }))
  )
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
