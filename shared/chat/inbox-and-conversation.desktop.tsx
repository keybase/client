import * as Kb from '@/common-adapters'
import {createPortal} from 'react-dom'
import Inbox from './inbox'
import InboxSearch from './inbox-search'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import {useDesktopInboxSearchPortalNode} from './inbox/desktop-search-portal'
import SearchRow from './inbox/search-row'
import {inboxWidth} from './inbox/row/sizes'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationDesktop(props: InboxAndConversationProps) {
  const conversationIDKey = props.conversationIDKey
  const search = useInboxSearch()
  const searchPortalNode = useDesktopInboxSearchPortalNode()

  const leftPane = (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
      {searchPortalNode
        ? createPortal(
            <SearchRow
              cancelSearch={search.cancelSearch}
              headerContext="chat-header"
              isSearching={search.isSearching}
              moveSelectedIndex={search.moveSelectedIndex}
              query={search.query}
              select={search.select}
              setQuery={search.setQuery}
              startSearch={search.startSearch}
            />,
            searchPortalNode
          )
        : null}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inboxBody}>
        {search.isSearching ? (
          <InboxSearch searchInfo={search.searchInfo} select={search.select} />
        ) : (
          <Inbox conversationIDKey={conversationIDKey} />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )

  return <InboxAndConversationShell {...props} leftPane={leftPane} />
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
    }) as const
)
