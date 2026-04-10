import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import ChatFilterRow from './filter-row'
import StartNewChat from './row/start-new-chat'
import type {InboxSearchController} from './use-inbox-search'

type OwnProps = {
  search: Pick<
    InboxSearchController,
    'cancelSearch' | 'isSearching' | 'moveSelectedIndex' | 'query' | 'selectResult' | 'setQuery' | 'startSearch'
  >
  showSearch: boolean
}

export default function InboxSearchRow(ownProps: OwnProps) {
  const {search, showSearch} = ownProps
  const {cancelSearch, isSearching, moveSelectedIndex, query, selectResult, setQuery, startSearch} = search
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
          onEnsureSelection={selectResult}
          onQueryChanged={onQueryChanged}
          query={query}
          showSearch={showSearch}
          startSearch={startSearch}
        />
      )}
    </>
  )
}
