import * as React from 'react'
import * as Kb from '@/common-adapters'

type BodyProps = {
  onChangeCode: (code: string) => void
  code: string
  onResend: () => void
  resendWaiting: boolean
}

const VerifyBody = (props: BodyProps) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  // build in a delay to resend
  // disable first, then enable after 2s
  const [resendDisabled, setResendDisabled] = React.useState(true)
  const enableResend = Kb.useTimeout(() => setResendDisabled(false), 4000)
  React.useEffect(() => enableResend(), [enableResend])
  const {onResend: _onResend} = props
  const onResend = () => {
    _onResend()
    setResendDisabled(true)
    enableResend()
  }

  return (
    <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} gap="small" style={styles.body}>
      <Kb.Text type="Body" negative={true} center={true}>
        Enter the code in the SMS you received:
      </Kb.Text>
      <Kb.Input3
        autoFocus={true}
        keyboardType="numeric"
        onChangeText={props.onChangeCode}
        textType="Header"
        textContentType="oneTimeCode"
        hideBorder={true}
        containerStyle={styles.inputContainer2}
        inputStyle={styles.inputText2}
      />
      <Kb.ClickableBox
        onClick={props.resendWaiting || resendDisabled ? undefined : onResend}
        direction="vertical"
        relative={true}
      >
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          gap="tiny"
          style={Kb.Styles.collapseStyles([
            styles.resend,
            (props.resendWaiting || resendDisabled) && styles.opacity30,
          ])}
        >
          <Kb.Icon
            type="iconfont-reload"
            color={theme.white}
            style={styles.iconVerticalAlign}
          />
          <Kb.Text type="BodySemibold" negative={true}>
            Resend SMS
          </Kb.Text>
        </Kb.Box2>
        {props.resendWaiting && (
          <Kb.Box2 direction="horizontal" style={styles.progressContainer} centerChildren={true}>
            <Kb.ProgressIndicator type="Small" white={true} />
          </Kb.Box2>
        )}
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      body: Kb.Styles.platformStyles({
        isMobile: {paddingTop: Kb.Styles.globalMargins.tiny},
      }),
      iconVerticalAlign: Kb.Styles.platformStyles({
        isElectron: {
          position: 'relative',
          top: 1,
        },
      }),
      inputContainer2: Kb.Styles.platformStyles({
        common: {
          backgroundColor: theme.blueDark,
          borderRadius: Kb.Styles.borderRadius,
        },
        isElectron: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.xsmall),
          height: 38,
          width: 368,
        },
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
          minHeight: 48,
          width: '100%',
        },
        isTablet: {maxWidth: 368},
      }),
      inputText2: Kb.Styles.platformStyles({
        common: {
          color: theme.white,
          letterSpacing: 20,
          textAlign: 'center',
        },
        isElectron: {
          fontVariant: 'none',
        },
      }),
      opacity30: {opacity: 0.3},
      progressContainer: Kb.Styles.platformStyles({
        common: {...Kb.Styles.globalStyles.fillAbsolute},
        isElectron: {paddingTop: Kb.Styles.globalMargins.tiny},
      }),
      resend: Kb.Styles.platformStyles({
        isElectron: {paddingTop: Kb.Styles.globalMargins.tiny},
      }),
    }) as const
)

export default VerifyBody
