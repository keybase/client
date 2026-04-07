// Just for desktop and tablet, we show inbox and conversation side by side
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import Conversation from './conversation/container'
import Inbox from './inbox'
import InboxSearch from './inbox-search'
import InfoPanel, {type Panel} from './conversation/info-panel'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
  infoPanel?: {tab?: Panel}
}

function InboxAndConversation(props: Props) {
  const conversationIDKey = props.conversationIDKey ?? Chat.noConversationIDKey
  const inboxSearch = Chat.useChatState(s => s.inboxSearch)
  const infoPanel = props.infoPanel
  const validConvoID = conversationIDKey && conversationIDKey !== Chat.noConversationIDKey
  const seenValidCIDRef = React.useRef(validConvoID ? conversationIDKey : '')
  const selectNextConvo = Chat.useChatState(s => {
    if (seenValidCIDRef.current) {
      return null
    }
    const first = s.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })

  React.useEffect(() => {
    if (selectNextConvo && seenValidCIDRef.current !== selectNextConvo) {
      seenValidCIDRef.current = selectNextConvo
      // need to defer , not sure why, shouldn't be
      setTimeout(() => {
        Chat.getConvoState(selectNextConvo).dispatch.navigateToThread('findNewestConversationFromLayout')
      }, 100)
    }
  }, [selectNextConvo])

  return (
    <Chat.ChatProvider id={conversationIDKey} canBeNull={true}>
      <Kb.KeyboardAvoidingView2>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} relative={true}>
          {!C.isTablet && inboxSearch ? (
            <InboxSearch />
          ) : (
            <Inbox conversationIDKey={conversationIDKey} />
          )}
          <Kb.Box2 direction="vertical" fullHeight={true} flex={1}>
            <Conversation />
          </Kb.Box2>
          {infoPanel ? (
            <Kb.Box2 direction="vertical" fullHeight={true} style={styles.infoPanel}>
              <InfoPanel key={conversationIDKey} tab={infoPanel.tab} />
            </Kb.Box2>
          ) : null}
        </Kb.Box2>
      </Kb.KeyboardAvoidingView2>
    </Chat.ChatProvider>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      infoPanel: {
        backgroundColor: Kb.Styles.globalColors.white,
        bottom: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        width: C.isTablet ? 350 : 320,
      },
    }) as const
)

export default InboxAndConversation
