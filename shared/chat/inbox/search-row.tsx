import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import ChatFilterRow from './filter-row'
import StartNewChat from './row/start-new-chat'
import {useInboxSearchState} from './search-state'

type OwnProps = {headerContext: 'chat-header' | 'inbox-header'}

export default function InboxSearchRow(ownProps: OwnProps) {
  const {headerContext} = ownProps
  const isSearching = useInboxSearchState(s => s.enabled)
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
  const {query, moveSelectedIndex, select, setQuery} = useInboxSearchState(
    C.useShallow(s => ({
      moveSelectedIndex: s.dispatch.moveSelectedIndex,
      query: s.searchInfo.query,
      select: s.dispatch.select,
      setQuery: s.dispatch.setQuery,
    }))
  )
  const showStartNewChat = !C.isMobile && !isSearching && showEmptyInbox
  const showFilter = isSearching || !showEmptyInbox

  const appendNewChatBuilder = C.Router2.appendNewChatBuilder
  const navigateUp = C.Router2.navigateUp

  const onQueryChanged = (q: string) => {
    setQuery(q)
  }

  const showNewChat = headerContext === 'chat-header'
  const showSearch = headerContext === 'chat-header' ? !C.isTablet : C.isMobile

  return (
    <>
      {!!showStartNewChat && (
        <StartNewChat onBack={navigateUp} onNewChat={appendNewChatBuilder} />
      )}
      {!!showFilter && (
        <ChatFilterRow
          onSelectUp={() => moveSelectedIndex(false)}
          onSelectDown={() => moveSelectedIndex(true)}
          onEnsureSelection={select}
          onQueryChanged={onQueryChanged}
          query={query}
          showNewChat={showNewChat}
          showSearch={showSearch}
        />
      )}
    </>
  )
}
