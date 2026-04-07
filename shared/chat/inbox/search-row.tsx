import * as React from 'react'
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import ChatFilterRow from './filter-row'
import StartNewChat from './row/start-new-chat'

type OwnProps = {headerContext: 'chat-header' | 'inbox-header'}

export default function InboxSearchRow(ownProps: OwnProps) {
  const {headerContext} = ownProps
  const chatState = Chat.useChatState(
    C.useShallow(s => {
      const hasLoadedEmptyInbox =
        s.inboxHasLoaded &&
        !!s.inboxLayout &&
        (s.inboxLayout.smallTeams || []).length === 0 &&
        (s.inboxLayout.bigTeams || []).length === 0
      return {
        inboxSearch: s.dispatch.inboxSearch,
        inboxSearchMoveSelectedIndex: s.dispatch.inboxSearchMoveSelectedIndex,
        inboxSearchSelect: s.dispatch.inboxSearchSelect,
        isSearching: !!s.inboxSearch,
        showEmptyInbox: !s.inboxSearch && hasLoadedEmptyInbox,
      }
    })
  )
  const {inboxSearch, inboxSearchMoveSelectedIndex, inboxSearchSelect, isSearching, showEmptyInbox} = chatState
  const showStartNewChat = !C.isMobile && showEmptyInbox
  const showFilter = !showEmptyInbox

  const appendNewChatBuilder = C.Router2.appendNewChatBuilder
  const navigateUp = C.Router2.navigateUp

  const [query, setQuery] = React.useState('')
  const onQueryChanged = (q: string) => {
    setQuery(q)
    inboxSearch(q)
  }

  const [lastSearching, setLastSearching] = React.useState(isSearching)
  if (lastSearching !== isSearching) {
    setLastSearching(isSearching)
    if (!isSearching) {
      setQuery('')
    }
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
          onSelectUp={() => inboxSearchMoveSelectedIndex(false)}
          onSelectDown={() => inboxSearchMoveSelectedIndex(true)}
          onEnsureSelection={inboxSearchSelect}
          onQueryChanged={onQueryChanged}
          query={query}
          showNewChat={showNewChat}
          showSearch={showSearch}
        />
      )}
    </>
  )
}
