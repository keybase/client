import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useThreadLoadStatus} from './thread-load-status-context'
import {useConversationThreadID} from './thread-context'

const ValidatedStatus = () => {
  const [visible, setVisible] = React.useState(true)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, 2000)
    return () => {
      clearTimeout(timer)
    }
  }, [])
  return visible ? (
    <Kb.Banner color="green" small={true} style={styles.banner}>
      End-to-end encrypted.
    </Kb.Banner>
  ) : null
}

const ThreadLoadStatus = () => {
  const status = useThreadLoadStatus()
  const conversationIDKey = useConversationThreadID()

  logger.info(`ThreadLoadStatus: convID: ${conversationIDKey} status: ${status}`)
  switch (status) {
    case T.RPCChat.UIChatThreadStatusTyp.server:
    case T.RPCChat.UIChatThreadStatusTyp.validating:
      return (
        <Kb.Banner color="grey" small={true} style={styles.banner}>
          {status === T.RPCChat.UIChatThreadStatusTyp.server
            ? 'Syncing messages with server...'
            : 'Validating sender signing keys...'}
        </Kb.Banner>
      )
    case T.RPCChat.UIChatThreadStatusTyp.validated:
      return <ValidatedStatus />
    default:
      return null
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        padding: Kb.Styles.globalMargins.xxtiny,
      },
    }) as const
)

export default ThreadLoadStatus
