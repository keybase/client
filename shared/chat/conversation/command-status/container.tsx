import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'

const empty = {
  actions: [],
  displayText: '',
  displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
}

const Container = () => {
  const info = C.useChatContext(s => s.commandStatus)
  const _info = info || empty

  const onOpenAppSettings = C.useConfigState(s => s.dispatch.dynamic.openAppSettings)
  const setCommandStatusInfo = C.useChatContext(s => s.dispatch.setCommandStatusInfo)
  const onCancel = () => {
    setCommandStatusInfo()
  }
  const props = {
    actions: _info.actions.map((a: T.RPCChat.UICommandStatusActionTyp | unknown) => {
      switch (a) {
        case T.RPCChat.UICommandStatusActionTyp.appsettings:
          return {
            displayText: 'View App Settings',
            onClick: () => onOpenAppSettings?.(),
          }
        default:
          return {
            displayText: '???',
            onClick: () => {},
          }
      }
    }),
    displayText: _info.displayText,
    displayType: _info.displayType,
    onCancel,
  }

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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      close: {
        alignSelf: 'center',
      },
      container: {
        padding: Styles.globalMargins.tiny,
      },
      contentContainer: {flex: 1},
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

export default Container
