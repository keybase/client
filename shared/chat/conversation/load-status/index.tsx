import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../styles'

type Props = {
  status?: RPCChatTypes.UIChatThreadStatus
}

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

const ThreadLoadStatus = (props: Props) => {
  if (!props.status || props.status.typ === RPCChatTypes.UIChatThreadStatusTyp.none) {
    return null
  }
  switch (props.status.typ) {
    case RPCChatTypes.UIChatThreadStatusTyp.server:
      return (
        <Kb.Banner color={getBkgColor(props.status)} small={true} style={styles.banner}>
          Syncing messages with server...
        </Kb.Banner>
      )
    case RPCChatTypes.UIChatThreadStatusTyp.validating:
      return (
        <Kb.Banner color={getBkgColor(props.status)} small={true} style={styles.banner}>
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
