import * as Kb from '@/common-adapters'
import Inbox from './inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from './inbox-and-conversation-shared'
import {inboxWidth} from './inbox/row/sizes'
import {useInboxSearch} from './inbox/use-inbox-search'

export default function InboxAndConversationDesktop(props: InboxAndConversationProps) {
  const search = useInboxSearch()
  const leftPane = (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
      <Inbox conversationIDKey={props.conversationIDKey} search={search} />
    </Kb.Box2>
  )

  return <InboxAndConversationShell {...props} leftPane={leftPane} />
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
