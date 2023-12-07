import * as React from 'react'
import * as C from '@/constants'
import ChatFilterRow from './filter-row'
import StartNewChat from './row/start-new-chat'

type OwnProps = {headerContext: 'chat-header' | 'inbox-header'}

export default React.memo(function InboxSearchRow(ownProps: OwnProps) {
  const {headerContext} = ownProps
  const hasLoadedEmptyInbox = C.useChatState(
    s =>
      s.inboxHasLoaded &&
      !!s.inboxLayout &&
      (s.inboxLayout.smallTeams || []).length === 0 &&
      (s.inboxLayout.bigTeams || []).length === 0
  )
  const showEmptyInbox = C.useChatState(s => !s.inboxSearch && hasLoadedEmptyInbox)
  const showStartNewChat = !C.isMobile && showEmptyInbox
  const isSearching = C.useChatState(s => !!s.inboxSearch)
  const showFilter = !showEmptyInbox

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = React.useCallback(() => {
    navigateUp()
  }, [navigateUp])

  const [query, setQuery] = React.useState('')
  const inboxSearchSelect = C.useChatState(s => s.dispatch.inboxSearchSelect)
  const inboxSearch = C.useChatState(s => s.dispatch.inboxSearch)
  const inboxSearchMoveSelectedIndex = C.useChatState(s => s.dispatch.inboxSearchMoveSelectedIndex)
  const onEnsureSelection = React.useCallback(() => {
    inboxSearchSelect()
  }, [inboxSearchSelect])

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const onNewChat = React.useCallback(() => {
    appendNewChatBuilder()
  }, [appendNewChatBuilder])
  const onQueryChanged = React.useCallback(
    (q: string) => {
      setQuery(q)
      inboxSearch(q)
    },
    [inboxSearch]
  )
  const onSelectDown = React.useCallback(() => {
    inboxSearchMoveSelectedIndex(true)
  }, [inboxSearchMoveSelectedIndex])
  const onSelectUp = React.useCallback(() => {
    inboxSearchMoveSelectedIndex(false)
  }, [inboxSearchMoveSelectedIndex])

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
      {!!showStartNewChat && <StartNewChat onBack={onBack} onNewChat={onNewChat} />}
      {!!showFilter && (
        <ChatFilterRow
          onSelectUp={onSelectUp}
          onSelectDown={onSelectDown}
          onEnsureSelection={onEnsureSelection}
          onQueryChanged={onQueryChanged}
          query={query}
          showNewChat={showNewChat}
          showSearch={showSearch}
        />
      )}
    </>
  )
})
