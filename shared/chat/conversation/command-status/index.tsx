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
  displayType: RPCChatTypes.UICommandStatusDisplayTyp
  onCancel: () => void
}

const bkgColor = (typ: RPCChatTypes.UICommandStatusDisplayTyp) => {
  switch (typ) {
    case RPCChatTypes.UICommandStatusDisplayTyp.error:
      return {backgroundColor: Styles.globalColors.red}
    case RPCChatTypes.UICommandStatusDisplayTyp.warning:
      return {backgroundColor: Styles.globalColors.yellowLight}
    case RPCChatTypes.UICommandStatusDisplayTyp.status:
      return {backgroundColor: Styles.globalColors.black_05}
  }
  return {}
}

const textColor = (typ: RPCChatTypes.UICommandStatusDisplayTyp) => {
  switch (typ) {
    case RPCChatTypes.UICommandStatusDisplayTyp.error:
      return {color: Styles.globalColors.white}
    case RPCChatTypes.UICommandStatusDisplayTyp.warning:
      return {}
    case RPCChatTypes.UICommandStatusDisplayTyp.status:
      return {}
  }
  return {}
}

const CommandStatus = (props: Props) => {
  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([bkgColor(props.displayType), styles.container])}
        gap="tiny"
      >
        <Kb.Icon
          onClick={props.onCancel}
          type="iconfont-remove"
          style={Kb.iconCastPlatformStyles(
            Styles.collapseStyles([textColor(props.displayType), styles.close])
          )}
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
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  close: {
    alignSelf: 'center',
  },
  container: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.tiny,
    },
    isElectron: {
      borderRadius: Styles.borderRadius,
    },
  }),
  outerContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      border: `1px solid ${Styles.globalColors.black_20}`,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
  }),
})

export default CommandStatus
