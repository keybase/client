// Just for desktop and tablet, we show inbox and conversation side by side
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import Conversation from './conversation/container'
import InfoPanel, {type Panel} from './conversation/info-panel'
import type {ThreadSearchRouteProps} from './conversation/thread-search-route'

export type InboxAndConversationProps = ThreadSearchRouteProps & {
  conversationIDKey?: T.Chat.ConversationIDKey
  infoPanel?: {tab?: Panel}
  refreshInbox?: T.Chat.ChatRootInboxRefresh
}

export type ChatRootRouteParams = InboxAndConversationProps

type Props = InboxAndConversationProps & {
  leftPane: React.ReactNode
}

export function InboxAndConversationShell(props: Props) {
  const conversationIDKey = props.conversationIDKey ?? Chat.noConversationIDKey
  const infoPanel = props.infoPanel
  const validConvoID = conversationIDKey && conversationIDKey !== Chat.noConversationIDKey
  const lastValidCIDRef = React.useRef(validConvoID ? conversationIDKey : '')
  const lastAutoSelectedCIDRef = React.useRef('')
  const selectNextConvo = Chat.useChatState(s => {
    if (validConvoID) {
      return null
    }
    const first = s.inboxLayout?.smallTeams?.[0]
    return first?.convID === lastValidCIDRef.current ? null : first?.convID
  })

  React.useEffect(() => {
    if (validConvoID) {
      lastValidCIDRef.current = conversationIDKey
      lastAutoSelectedCIDRef.current = ''
      return
    }
    if (selectNextConvo && lastAutoSelectedCIDRef.current !== selectNextConvo) {
      lastAutoSelectedCIDRef.current = selectNextConvo
      // need to defer , not sure why, shouldn't be
      setTimeout(() => {
        C.Router2.navigateToThread(selectNextConvo, 'findNewestConversationFromLayout')
      }, 100)
    }
  }, [conversationIDKey, selectNextConvo, validConvoID])

  return (
    <ConvoState.ChatProvider id={conversationIDKey} canBeNull={true}>
      <Kb.KeyboardAvoidingView2>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} relative={true}>
          {props.leftPane}
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
    </ConvoState.ChatProvider>
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
