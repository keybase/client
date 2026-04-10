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
import type {ThreadSearchRouteProps} from './conversation/thread-search-route'
import SearchRow from './inbox/search-row'
import {inboxWidth} from './inbox/row/sizes'
import {useInboxSearch} from './inbox/use-inbox-search'

type Props = ThreadSearchRouteProps & {
  conversationIDKey?: T.Chat.ConversationIDKey
  infoPanel?: {tab?: Panel}
}

function InboxAndConversationBody(props: Props) {
  const conversationIDKey = props.conversationIDKey ?? Chat.noConversationIDKey
  const search = useInboxSearch()
  const isSearching = search.isSearching
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
          {!C.isTablet ? (
            <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
              <SearchRow
                cancelSearch={search.cancelSearch}
                headerContext="chat-header"
                isSearching={search.isSearching}
                moveSelectedIndex={search.moveSelectedIndex}
                query={search.query}
                select={search.select}
                setQuery={search.setQuery}
                startSearch={search.startSearch}
              />
              <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inboxBody}>
                {isSearching ? (
                  <InboxSearch searchInfo={search.searchInfo} select={search.select} />
                ) : (
                  <Inbox conversationIDKey={conversationIDKey} />
                )}
              </Kb.Box2>
            </Kb.Box2>
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
      inboxBody: {
        flex: 1,
        minHeight: 0,
      },
      inboxPane: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        maxWidth: inboxWidth,
        minWidth: inboxWidth,
      },
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

export default InboxAndConversationBody
