import * as Kb from '@/common-adapters'
import Inbox from '@/chat/inbox'
import {InboxAndConversationShell, type InboxAndConversationProps} from '@/chat/inbox-and-conversation-shared'
import {inboxWidth} from '@/chat/inbox/row/sizes'
import useInboxHeaderPortal from '@/chat/inbox/use-header-portal'
import {useInboxSearch} from '@/chat/inbox/use-inbox-search'

export default function InboxAndConversation(props: InboxAndConversationProps) {
  const styles = useStyles()
  const search = useInboxSearch()
  const headerPortal = useInboxHeaderPortal(search)
  const inbox = (
    <Inbox
      conversationIDKey={props.conversationIDKey}
      refreshInbox={props.refreshInbox}
      search={search}
    />
  )
  const leftPane = isMobile ? (
    inbox
  ) : (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.inboxPane}>
      {inbox}
    </Kb.Box2>
  )

  return (
    <>
      {headerPortal}
      <InboxAndConversationShell {...props} leftPane={leftPane} />
    </>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  inboxPane: {
    backgroundColor: theme.blueGrey,
    maxWidth: inboxWidth,
    minWidth: inboxWidth,
  },
}))

export type {ChatRootRouteParams, InboxAndConversationProps} from '@/chat/inbox-and-conversation-shared'
