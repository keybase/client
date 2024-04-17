// Just for desktop and tablet, we show inbox and conversation side by side
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import Conversation from './conversation/container'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search'
import InfoPanel from './conversation/info-panel'

type Props = {conversationIDKey?: T.Chat.ConversationIDKey; navKey?: string}

const InboxAndConversation = React.memo(function InboxAndConversation(props: Props) {
  const conversationIDKey = props.conversationIDKey ?? C.Chat.noConversationIDKey
  const navKey = props.navKey ?? ''
  const inboxSearch = C.useChatState(s => s.inboxSearch)
  const infoPanelShowing = C.useChatState(s => s.infoPanelShowing)
  const validConvoID = conversationIDKey && conversationIDKey !== C.Chat.noConversationIDKey
  const seenValidCIDRef = React.useRef(validConvoID ? conversationIDKey : '')
  const selectNextConvo = C.useChatState(s => {
    if (seenValidCIDRef.current) {
      return null
    }
    const first = s.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })

  if (selectNextConvo) {
    seenValidCIDRef.current = selectNextConvo
    // need to defer render navs outside of render
    setTimeout(() => {
      C.getConvoState(selectNextConvo).dispatch.navigateToThread('findNewestConversationFromLayout')
    }, 1)
  }

  return (
    <C.ChatProvider id={conversationIDKey} canBeNull={true}>
      <Kb.KeyboardAvoidingView2>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.container}>
          {!C.isTablet && inboxSearch ? (
            <InboxSearch />
          ) : (
            <Inbox navKey={navKey} conversationIDKey={conversationIDKey} />
          )}
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.conversation}>
            <Conversation />
          </Kb.Box2>
          {infoPanelShowing ? (
            <Kb.Box2 direction="vertical" fullHeight={true} style={styles.infoPanel}>
              <InfoPanel />
            </Kb.Box2>
          ) : null}
        </Kb.Box2>
      </Kb.KeyboardAvoidingView2>
    </C.ChatProvider>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
      conversation: {flexGrow: 1},
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
