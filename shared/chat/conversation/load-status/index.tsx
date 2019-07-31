import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../styles'

type Props = {
  status: RPCChatTypes.UIChatThreadStatus | null
}

type ValidatedStatusProps = {
  status: RPCChatTypes.UIChatThreadStatus
}

const ValidatedStatus = (props: ValidatedStatusProps) => {
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
    <Container status={props.status}>
      <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
        <Kb.Icon type="iconfont-check" color={Styles.globalColors.white} sizeType="Tiny" />
        <Kb.Text type="BodyTiny" style={{color: Styles.globalColors.white}}>
          {'End-to-end encrypted'}
        </Kb.Text>
      </Kb.Box2>
    </Container>
  ) : null
}

type ContainerProps = {
  children: React.ReactNode
  status: RPCChatTypes.UIChatThreadStatus
}

const Container = (props: ContainerProps) => {
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      centerChildren={true}
      style={Styles.collapseStyles([styles.container, {backgroundColor: getBkgColor(props.status)}])}
    >
      {props.children}
    </Kb.Box2>
  )
}

const getBkgColor = (status: RPCChatTypes.UIChatThreadStatus) => {
  switch (status.typ) {
    case RPCChatTypes.UIChatThreadStatusTyp.validated:
      return Styles.globalColors.green
    default:
      return Styles.globalColors.grey
  }
}

const ThreadLoadStatus = (props: Props) => {
  if (!props.status || props.status.typ === RPCChatTypes.UIChatThreadStatusTyp.none) {
    return null
  }
  switch (props.status.typ) {
    case RPCChatTypes.UIChatThreadStatusTyp.server:
      return (
        <Container status={props.status}>
          <Kb.Text type="BodyTiny">{'Syncing messages with server...'}</Kb.Text>
        </Container>
      )
    case RPCChatTypes.UIChatThreadStatusTyp.validating:
      return (
        <Container status={props.status}>
          <Kb.Text type="BodyTiny">{'Validating sender signing keys...'}</Kb.Text>
        </Container>
      )
    case RPCChatTypes.UIChatThreadStatusTyp.validated:
      return <ValidatedStatus status={props.status} />
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    left: 0,
    padding: Styles.globalMargins.xxtiny,
    position: 'absolute',
    top: 0,
  },
})

export default ThreadLoadStatus
