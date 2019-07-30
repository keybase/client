import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../styles'

type Props = {
  status: RPCChatTypes.UIChatThreadStatus | null
}

const getDisplay = (status: RPCChatTypes.UIChatThreadStatus) => {
  switch (status.typ) {
    case RPCChatTypes.UIChatThreadStatusTyp.server:
      return <Kb.Text type="BodySmall">{'Loading messages from server...'}</Kb.Text>
    case RPCChatTypes.UIChatThreadStatusTyp.validating:
      return <Kb.Text type="BodySmall">{'Validating sender signing keys...'}</Kb.Text>
    case RPCChatTypes.UIChatThreadStatusTyp.validated:
      return (
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
          <Kb.Icon type="iconfont-check" color={Styles.globalColors.white} />
          <Kb.Text type="BodySmall" style={{color: Styles.globalColors.white}}>
            {'End-to-end encrypted'}
          </Kb.Text>
        </Kb.Box2>
      )
  }
  return 'UNKNIWN'
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
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      centerChildren={true}
      style={Styles.collapseStyles([styles.container, {backgroundColor: getBkgColor(props.status)}])}
    >
      {getDisplay(props.status)}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.xtiny,
    position: 'absolute',
    top: 0,
    left: 0,
  },
})

export default ThreadLoadStatus
