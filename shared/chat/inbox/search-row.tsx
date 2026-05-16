import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import ChatFilterRow from '@/chat/inbox/filter-row'
import NewChatButton from '@/chat/inbox/new-chat-button'
import StartNewChat from '@/chat/inbox/row/start-new-chat'
import {isEmptyInboxLayout, useInboxLayoutState} from '@/chat/inbox/layout-state'
import type {InboxSearchController} from '@/chat/inbox/use-inbox-search'

type OwnProps = {
  search: Pick<
    InboxSearchController,
    'cancelSearch' | 'isSearching' | 'moveSelectedIndex' | 'query' | 'selectResult' | 'setQuery' | 'startSearch'
  >
  forceShowFilter?: boolean
  showSearch: boolean
  showNewChatButton?: boolean
}

export default function InboxSearchRow(ownProps: OwnProps) {
  const {forceShowFilter, search, showNewChatButton, showSearch} = ownProps
  const {cancelSearch, isSearching, moveSelectedIndex, query, selectResult, setQuery, startSearch} = search
  const chatState = useInboxLayoutState(
    C.useShallow(s => {
      const hasLoadedEmptyInbox = s.hasLoaded && isEmptyInboxLayout(s.layout)
      return {
        showEmptyInbox: hasLoadedEmptyInbox,
      }
    })
  )
  const {showEmptyInbox} = chatState
  const showStartNewChat = !showNewChatButton && !C.isMobile && !isSearching && showEmptyInbox
  const showFilter = !!forceShowFilter || isSearching || !showEmptyInbox

  const appendNewChatBuilder = C.Router2.appendNewChatBuilder
  const navigateUp = C.Router2.navigateUp

  const filter = showFilter ? (
    <ChatFilterRow
      isSearching={isSearching}
      onCancelSearch={cancelSearch}
      onSelectUp={() => moveSelectedIndex(false)}
      onSelectDown={() => moveSelectedIndex(true)}
      onEnsureSelection={selectResult}
      onQueryChanged={setQuery}
      query={query}
      showSearch={showSearch}
      startSearch={startSearch}
    />
  ) : null

  if (showNewChatButton) {
    return (
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.row}>
        <Kb.BoxGrow2>{filter}</Kb.BoxGrow2>
        <NewChatButton />
      </Kb.Box2>
    )
  }

  return (
    <>
      {!!showStartNewChat && <StartNewChat onBack={navigateUp} onNewChat={appendNewChatBuilder} />}
      {filter}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      row: {
        alignItems: 'center',
        height: '100%',
        paddingRight: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
    }) as const
)
