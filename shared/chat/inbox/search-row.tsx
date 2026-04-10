import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import ChatFilterRow from './filter-row'
import StartNewChat from './row/start-new-chat'
import type * as T from '@/constants/types'

type OwnProps = {
  cancelSearch: () => void
  headerContext: 'chat-header' | 'inbox-header'
  isSearching: boolean
  moveSelectedIndex: (increment: boolean) => void
  query: string
  select: (
    conversationIDKey?: T.Chat.ConversationIDKey,
    query?: string,
    selectedIndex?: number
  ) => void
  setQuery: (query: string) => void
  startSearch: () => void
}

export default function InboxSearchRow(ownProps: OwnProps) {
  const {cancelSearch, headerContext, isSearching, moveSelectedIndex, query, select, setQuery, startSearch} =
    ownProps
  const chatState = Chat.useChatState(
    C.useShallow(s => {
      const hasLoadedEmptyInbox =
        s.inboxHasLoaded &&
        !!s.inboxLayout &&
        (s.inboxLayout.smallTeams || []).length === 0 &&
        (s.inboxLayout.bigTeams || []).length === 0
      return {
        showEmptyInbox: hasLoadedEmptyInbox,
      }
    })
  )
  const {showEmptyInbox} = chatState
  const showStartNewChat = !C.isMobile && !isSearching && showEmptyInbox
  const showFilter = isSearching || !showEmptyInbox

  const appendNewChatBuilder = C.Router2.appendNewChatBuilder
  const navigateUp = C.Router2.navigateUp

  const onQueryChanged = (q: string) => {
    setQuery(q)
  }

  const showSearch = headerContext === 'chat-header' ? !C.isTablet : C.isMobile

  return (
    <>
      {!!showStartNewChat && (
        <StartNewChat onBack={navigateUp} onNewChat={appendNewChatBuilder} />
      )}
      {!!showFilter && (
        <ChatFilterRow
          isSearching={isSearching}
          onCancelSearch={cancelSearch}
          onSelectUp={() => moveSelectedIndex(false)}
          onSelectDown={() => moveSelectedIndex(true)}
          onEnsureSelection={select}
          onQueryChanged={onQueryChanged}
          query={query}
          showSearch={showSearch}
          startSearch={startSearch}
        />
      )}
    </>
  )
}
