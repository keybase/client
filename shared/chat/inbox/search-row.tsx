import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import ChatFilterRow from './filter-row'
import NewChatButton from './new-chat-button'
import StartNewChat from './row/start-new-chat'
import type {InboxSearchController} from './use-inbox-search'

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
