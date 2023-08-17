import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as T from '../../constants/types'
import * as Styles from '../../styles'

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
  const status = C.useChatContext(s => s.threadLoadStatus)

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
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        padding: Styles.globalMargins.xxtiny,
      },
    }) as const
)

export default ThreadLoadStatus
