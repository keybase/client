import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

type Action = {
  displayText: string
  onClick: () => void
}

type Props = {
  actions: Array<Action>
  displayText: string
  displayType: RPCChatTypes.UISlashFeedbackTyp
  onCancel: () => void
}

const bkgColor = (typ: RPCChatTypes.UISlashFeedbackTyp) => {
  switch (typ) {
    case RPCChatTypes.UISlashFeedbackTyp.error:
      return {backgroundColor: Styles.globalColors.red}
    case RPCChatTypes.UISlashFeedbackTyp.warning:
      return {backgroundColor: Styles.globalColors.yellowLight}
    case RPCChatTypes.UISlashFeedbackTyp.status:
      return {backgroundColor: Styles.globalColors.black_05}
  }
  return {}
}

const textColor = (typ: RPCChatTypes.UISlashFeedbackTyp) => {
  switch (typ) {
    case RPCChatTypes.UISlashFeedbackTyp.error:
      return {color: Styles.globalColors.white}
    case RPCChatTypes.UISlashFeedbackTyp.warning:
      return {}
    case RPCChatTypes.UISlashFeedbackTyp.status:
      return {}
  }
  return {}
}

const CommandStatus = (props: Props) => {
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([bkgColor(props.displayType), styles.container])}
      gap="tiny"
    >
      <Kb.Icon
        onClick={props.onCancel}
        type="iconfont-remove"
        style={Kb.iconCastPlatformStyles(Styles.collapseStyles([textColor(props.displayType), styles.close]))}
        boxStyle={styles.close}
      />
      <Kb.Text type="BodySmall" style={Styles.collapseStyles([textColor(props.displayType)])}>
        {props.displayText}
      </Kb.Text>
      {props.actions.map((a, i) => {
        return (
          <Kb.Text
            key={i}
            type="BodySmallSemiboldPrimaryLink"
            onClick={a.onClick}
            style={Styles.collapseStyles([textColor(props.displayType)])}
          >
            {a.displayText}
          </Kb.Text>
        )
      })}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  close: {
    alignSelf: 'center',
  },
  container: {
    padding: Styles.globalMargins.tiny,
  },
})

export default CommandStatus
