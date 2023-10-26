// Just for desktop and tablet, we show inbox and conversation side by side
import * as C from '../constants'
import * as Kb from '../common-adapters'
import * as React from 'react'
import type * as T from '../constants/types'
import Conversation from './conversation/container'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search'
import InfoPanel from './conversation/info-panel'

type Props = {conversationIDKey?: T.Chat.ConversationIDKey; navKey?: string}

const InboxAndConversation = React.memo(function InboxAndConversation(props?: Props) {
  const conversationIDKey = props?.conversationIDKey ?? C.noConversationIDKey
  const navKey = props?.navKey ?? ''
  const inboxSearch = C.useChatState(s => s.inboxSearch)
  const infoPanelShowing = C.useChatState(s => s.infoPanelShowing)
  const validConvoID = conversationIDKey && conversationIDKey !== C.noConversationIDKey
  const needSelectConvoID = C.useChatState(s => {
    if (validConvoID) {
      return null
    }
    const first = s.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })

  C.useOnMountOnce(() => {
    if (needSelectConvoID) {
      // hack to select the convo after we render
      setTimeout(() => {
        C.getConvoState(needSelectConvoID).dispatch.navigateToThread('findNewestConversationFromLayout')
      }, 1)
    }
  })

  return (
    <Kb.KeyboardAvoidingView2>
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.container}>
        {!C.isTablet && inboxSearch ? (
          <InboxSearch />
        ) : (
          <Inbox navKey={navKey} conversationIDKey={conversationIDKey} />
        )}
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.conversation}>
          <C.ChatProvider id={conversationIDKey} canBeNull={true}>
            <Conversation conversationIDKey={conversationIDKey} />
          </C.ChatProvider>
        </Kb.Box2>
        {infoPanelShowing ? (
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.infoPanel}>
            <C.ChatProvider id={conversationIDKey} canBeNull={true}>
              <InfoPanel conversationIDKey={conversationIDKey} />
            </C.ChatProvider>
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    </Kb.KeyboardAvoidingView2>
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
        width: 320,
      },
    }) as const
)

export default InboxAndConversation
