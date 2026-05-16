import * as Kb from '@/common-adapters'
import Inbox from '@/chat/inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from '@/chat/inbox-and-conversation-shared'
import {inboxWidth} from '@/chat/inbox/row/sizes'
import useInboxHeaderPortal from '@/chat/inbox/use-header-portal'
import {useInboxSearch} from '@/chat/inbox/use-inbox-search'

export default function InboxAndConversationDesktop(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const headerPortal = useInboxHeaderPortal(search)
  const leftPane = (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
      <Inbox conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} search={search} />
    </Kb.Box2>
  )

  return (
    <>
      {headerPortal}
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
    }) as const
)
