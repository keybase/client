import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as InputState from './input-area/input-state'
import {openAppSettings} from '@/util/storeless-actions'

const empty = {
  actions: [],
  displayText: '',
  displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
}

const Container = () => {
  const theme = Kb.Styles.useTheme()
  const styles = useStyles()
  const info = InputState.useConversationInput(s => s.commandStatus)
  const _info = info || empty

  const setCommandStatusInfo = InputState.useConversationInputDispatch(s => s.setCommandStatusInfo)
  const onCancel = () => {
    setCommandStatusInfo()
  }
  const props = {
    actions: _info.actions.map(() => ({
      displayText: 'View App Settings',
      onClick: openAppSettings,
    })),
    displayText: _info.displayText,
    displayType: _info.displayType,
    onCancel,
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.outerContainer}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        padding="tiny"
        style={bkgColor(props.displayType, theme)}
        gap="xsmall"
      >
        <Kb.Icon
          onClick={props.onCancel}
          type="iconfont-remove"
          style={styles.close}
          color={textColor(props.displayType, theme)}
        />
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} gap="tiny">
          <Kb.Text type="BodySmall" style={Kb.Styles.collapseStyles([{color: textColor(props.displayType, theme)}])}>
            {props.displayText}
          </Kb.Text>
          {props.actions.map((a, i) => {
            return (
              <Kb.Text
                key={i}
                negative={true}
                type="BodySmallSemiboldPrimaryLink"
                onClick={a.onClick}
                style={Kb.Styles.collapseStyles([{color: textColor(props.displayType, theme)}])}
                underline={true}
              >
                {a.displayText}
              </Kb.Text>
            )
          })}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const bkgColor = (typ: T.RPCChat.UICommandStatusDisplayTyp, theme: Kb.Styles.Theme) => {
  switch (typ) {
    case T.RPCChat.UICommandStatusDisplayTyp.error:
      return {backgroundColor: theme.red}
    case T.RPCChat.UICommandStatusDisplayTyp.warning:
      return {backgroundColor: theme.yellowLight}
    case T.RPCChat.UICommandStatusDisplayTyp.status:
      return {}
    default:
      return {}
  }
}

const textColor = (typ: T.RPCChat.UICommandStatusDisplayTyp, theme: Kb.Styles.Theme) => {
  switch (typ) {
    case T.RPCChat.UICommandStatusDisplayTyp.error:
      return theme.white
    case T.RPCChat.UICommandStatusDisplayTyp.warning:
      return theme.blackOrBlack
    case T.RPCChat.UICommandStatusDisplayTyp.status:
      return theme.black
    default:
      return theme.black
  }
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      close: {
        alignSelf: 'center',
      },
      outerContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          border: `1px solid ${theme.black_20}`,
          borderRadius: Kb.Styles.borderRadius,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          ...Kb.Styles.marginH(Kb.Styles.globalMargins.small),
          overflow: 'hidden',
        },
        isMobile: {
          borderColor: theme.black_20,
          borderStyle: 'solid',
          borderTopWidth: 1,
        },
      }),
    }) as const
)

export default Container
