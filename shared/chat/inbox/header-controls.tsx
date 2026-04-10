import * as Kb from '@/common-adapters'
import ChatFilterRow from './filter-row'
import NewChatButton from './new-chat-button'
import type {InboxSearchController} from './use-inbox-search'

type Props = {
  search: Pick<
    InboxSearchController,
    'cancelSearch' | 'isSearching' | 'moveSelectedIndex' | 'query' | 'selectResult' | 'setQuery' | 'startSearch'
  >
}

export default function InboxHeaderControls({search}: Props) {
  return (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.row}>
      <Kb.BoxGrow2>
        <ChatFilterRow
          isSearching={search.isSearching}
          onCancelSearch={search.cancelSearch}
          onSelectUp={() => search.moveSelectedIndex(false)}
          onSelectDown={() => search.moveSelectedIndex(true)}
          onEnsureSelection={search.selectResult}
          onQueryChanged={search.setQuery}
          query={search.query}
          showSearch={true}
          startSearch={search.startSearch}
        />
      </Kb.BoxGrow2>
      <NewChatButton />
    </Kb.Box2>
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
