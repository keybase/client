import * as Kb from '@/common-adapters'
import {createPortal} from 'react-dom'
import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import {useDesktopInboxSearchPortalNode} from './inbox/desktop-search-portal'
import ChatFilterRow from './inbox/filter-row'
import NewChatButton from './inbox/new-chat-button'
import {inboxWidth} from './inbox/row/sizes'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationDesktop(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const searchPortalNode = useDesktopInboxSearchPortalNode()
  const searchBar = (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.topBar}>
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
  const leftPane = (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
      <Inbox conversationIDKey={props.conversationIDKey} search={search} />
    </Kb.Box2>
  )

  return (
    <>
      {searchPortalNode ? createPortal(searchBar, searchPortalNode) : null}
      <InboxAndConversationShell {...props} leftPane={leftPane} />
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      inboxPane: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        maxWidth: inboxWidth,
        minWidth: inboxWidth,
      },
      topBar: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        height: '100%',
        paddingRight: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
    }) as const
)
