import * as Kb from '@/common-adapters'
import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import {inboxWidth} from './inbox/row/sizes'
import useInboxHeaderPortal from './inbox/use-header-portal'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationDesktop(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const headerPortal = useInboxHeaderPortal(search)
  const inboxProps = {
    search,
    ...(props.conversationIDKey === undefined ? {} : {conversationIDKey: props.conversationIDKey}),
    ...(props.refreshInbox === undefined ? {} : {refreshInbox: props.refreshInbox}),
  }
  const leftPane = (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
      <Inbox {...inboxProps} />
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
