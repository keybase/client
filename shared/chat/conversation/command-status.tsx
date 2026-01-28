import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'

const empty = {
  actions: [],
  displayText: '',
  displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
}

const Container = () => {
  const info = Chat.useChatContext(s => s.commandStatus)
  const _info = info || empty

  const onOpenAppSettings = useConfigState(s => s.dispatch.defer.openAppSettings)
  const setCommandStatusInfo = Chat.useChatContext(s => s.dispatch.setCommandStatusInfo)
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
        style={Kb.Styles.collapseStyles([bkgColor(props.displayType), styles.container])}
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
          <Kb.Text type="BodySmall" style={Kb.Styles.collapseStyles([{color: textColor(props.displayType)}])}>
            {props.displayText}
          </Kb.Text>
          {props.actions.map((a, i) => {
            return (
              <Kb.Text
                key={i}
                negative={true}
                type="BodySmallSemiboldPrimaryLink"
                onClick={a.onClick}
                style={Kb.Styles.collapseStyles([{color: textColor(props.displayType)}])}
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
      return {backgroundColor: Kb.Styles.globalColors.red}
    case T.RPCChat.UICommandStatusDisplayTyp.warning:
      return {backgroundColor: Kb.Styles.globalColors.yellowLight}
    case T.RPCChat.UICommandStatusDisplayTyp.status:
      return {}
    default:
      return {}
  }
}

const textColor = (typ: T.RPCChat.UICommandStatusDisplayTyp) => {
  switch (typ) {
    case T.RPCChat.UICommandStatusDisplayTyp.error:
      return Kb.Styles.globalColors.white
    case T.RPCChat.UICommandStatusDisplayTyp.warning:
      return Kb.Styles.globalColors.blackOrBlack
    case T.RPCChat.UICommandStatusDisplayTyp.status:
      return Kb.Styles.globalColors.black
    default:
      return Kb.Styles.globalColors.black
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      close: {
        alignSelf: 'center',
      },
      container: {
        padding: Kb.Styles.globalMargins.tiny,
      },
      contentContainer: {flex: 1},
      outerContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          border: `1px solid ${Kb.Styles.globalColors.black_20}`,
          borderRadius: Kb.Styles.borderRadius,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
          overflow: 'hidden',
        },
        isMobile: {
          borderColor: Kb.Styles.globalColors.black_20,
          borderStyle: 'solid',
          borderTopWidth: 1,
        },
      }),
    }) as const
)

export default Container
