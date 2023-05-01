import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/chat2'

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

const getBkgColor = (status: RPCChatTypes.UIChatThreadStatus) => {
  switch (status.typ) {
    case RPCChatTypes.UIChatThreadStatusTyp.validated:
      return 'green'
    default:
      return 'grey'
  }
}

const ThreadLoadStatus = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p

  const status = Container.useSelector(state => state.chat2.threadLoadStatus.get(conversationIDKey))

  if (!status || status.typ === RPCChatTypes.UIChatThreadStatusTyp.none) {
    return null
  }
  switch (status.typ) {
    case RPCChatTypes.UIChatThreadStatusTyp.server:
      return (
        <Kb.Banner color={getBkgColor(status)} small={true} style={styles.banner}>
          Syncing messages with server...
        </Kb.Banner>
      )
    case RPCChatTypes.UIChatThreadStatusTyp.validating:
      return (
        <Kb.Banner color={getBkgColor(status)} small={true} style={styles.banner}>
          Validating sender signing keys...
        </Kb.Banner>
      )
    case RPCChatTypes.UIChatThreadStatusTyp.validated:
      return <ValidatedStatus />
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        padding: Styles.globalMargins.xxtiny,
      },
    } as const)
)

export default ThreadLoadStatus
