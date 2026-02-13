import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'

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

const getBkgColor = (status: T.RPCChat.UIChatThreadStatusTyp) => {
  switch (status) {
    case T.RPCChat.UIChatThreadStatusTyp.validated:
      return 'green'
    default:
      return 'grey'
  }
}

const ThreadLoadStatus = () => {
  const status = Chat.useChatContext(s => s.threadLoadStatus)
  const conversationIDKey = Chat.useChatContext(s => s.id)

  logger.info(`ThreadLoadStatus: convID: ${conversationIDKey} status: ${status}`)
  if (status === T.RPCChat.UIChatThreadStatusTyp.none) {
    return null
  }
  switch (status) {
    case T.RPCChat.UIChatThreadStatusTyp.server:
      return (
        <Kb.Banner color={getBkgColor(status)} small={true} style={styles.banner}>
          Syncing messages with server...
        </Kb.Banner>
      )
    case T.RPCChat.UIChatThreadStatusTyp.validating:
      return (
        <Kb.Banner color={getBkgColor(status)} small={true} style={styles.banner}>
          Validating sender signing keys...
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
