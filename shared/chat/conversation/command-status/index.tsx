import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as T from '../../../constants/types'

type Action = {
  displayText: string
  onClick: () => void
}

type Props = {
  actions: Array<Action>
  displayText: string
  displayType: T.RPCChat.UICommandStatusDisplayTyp
  onCancel: () => void
}

const bkgColor = (typ: T.RPCChat.UICommandStatusDisplayTyp) => {
  switch (typ) {
    case T.RPCChat.UICommandStatusDisplayTyp.error:
      return {backgroundColor: Styles.globalColors.red}
    case T.RPCChat.UICommandStatusDisplayTyp.warning:
      return {backgroundColor: Styles.globalColors.yellowLight}
    case T.RPCChat.UICommandStatusDisplayTyp.status:
      return {}
    default:
      return {}
  }
}

const textColor = (typ: T.RPCChat.UICommandStatusDisplayTyp) => {
  switch (typ) {
    case T.RPCChat.UICommandStatusDisplayTyp.error:
      return Styles.globalColors.white
    case T.RPCChat.UICommandStatusDisplayTyp.warning:
      return Styles.globalColors.blackOrBlack
    case T.RPCChat.UICommandStatusDisplayTyp.status:
      return Styles.globalColors.black
    default:
      return Styles.globalColors.black
  }
}

const CommandStatus = (props: Props) => {
  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([bkgColor(props.displayType), styles.container])}
        gap="xsmall"
      >
        <Kb.Icon
          onClick={props.onCancel}
          type="iconfont-remove"
          style={styles.close}
          color={textColor(props.displayType)}
          boxStyle={styles.close}
        />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer} gap="tiny">
          <Kb.Text type="BodySmall" style={Styles.collapseStyles([{color: textColor(props.displayType)}])}>
            {props.displayText}
          </Kb.Text>
          {props.actions.map((a, i) => {
            return (
              <Kb.Text
                key={i}
                negative={true}
                type="BodySmallSemiboldPrimaryLink"
                onClick={a.onClick}
                style={Styles.collapseStyles([{color: textColor(props.displayType)}])}
                underline={true}
              >
                {a.displayText}
              </Kb.Text>
            )
          })}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      close: {
        alignSelf: 'center',
      },
      container: {
        padding: Styles.globalMargins.tiny,
      },
      contentContainer: {
        flex: 1,
      },
      outerContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.boxShadow,
          border: `1px solid ${Styles.globalColors.black_20}`,
          borderRadius: Styles.borderRadius,
          marginBottom: Styles.globalMargins.xtiny,
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
          overflow: 'hidden',
        },
        isMobile: {
          borderColor: Styles.globalColors.black_20,
          borderStyle: 'solid',
          borderTopWidth: 1,
        },
      }),
    }) as const
)

export default CommandStatus
