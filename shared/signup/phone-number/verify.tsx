import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '../common'
import {e164ToDisplay} from '@/util/phone-numbers'

export type Props = {
  error: string
  onBack: () => void
  onContinue: (code: string) => void
  onResend: () => void
  phoneNumber: string
  resendWaiting: boolean
  verifyWaiting: boolean
}

const VerifyPhoneNumber = (props: Props) => {
  const [code, onChangeCode] = React.useState('')
  const disabled = !code
  const onContinue = () => (disabled ? {} : props.onContinue(code))
  const displayPhone = e164ToDisplay(props.phoneNumber)
  return (
    <SignupScreen
      onBack={props.onBack}
      banners={
        props.error ? (
          <Kb.Banner key="error" color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.error} />
          </Kb.Banner>
        ) : null
      }
      buttons={[{label: 'Continue', onClick: onContinue, type: 'Success', waiting: props.verifyWaiting}]}
      titleComponent={
        <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
          {displayPhone}
        </Kb.Text>
      }
      containerStyle={styles.container}
      headerStyle={styles.container}
      header={
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.headerContainer}>
          <Kb.Text type="BodyBigLink" style={styles.backButton} onClick={props.onBack}>
            Back
          </Kb.Text>
          <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
            {displayPhone}
          </Kb.Text>
          <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne} />
        </Kb.Box2>
      }
      negativeHeader={true}
      skipMobileHeader={true}
      showHeaderInfoicon={true}
    >
      <VerifyBody
        onChangeCode={onChangeCode}
        code={code}
        onResend={props.onResend}
        resendWaiting={props.resendWaiting}
      />
    </SignupScreen>
  )
}

type BodyProps = {
  onChangeCode: (code: string) => void
  code: string
  onResend: () => void
  resendWaiting: boolean
}
export const VerifyBody = (props: BodyProps) => {
  // build in a delay to resend
  // disable first, then enable after 2s
  const [resendDisabled, setResendDisabled] = React.useState(true)
  const enableResend = Kb.useTimeout(() => setResendDisabled(false), 4000)
  React.useEffect(() => enableResend(), [enableResend])
  const {onResend: _onResend} = props
  const onResend = React.useCallback(() => {
    _onResend()
    setResendDisabled(true)
    enableResend()
  }, [_onResend, enableResend])

  return (
    <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} gap="small" style={styles.body}>
      <Kb.Text type="Body" negative={true} center={true}>
        Enter the code in the SMS you received:
      </Kb.Text>
      <Kb.PlainInput
        autoFocus={true}
        style={styles.input}
        flexable={true}
        keyboardType="numeric"
        onChangeText={props.onChangeCode}
        textType="Header"
        textContentType="oneTimeCode"
      >
        {Kb.Styles.isAndroid ? undefined : (
          <Kb.Text type="Header" style={styles.inputText}>
            {/* We put this child in Input because some text styles don't work on RN input itself - the one we need here is letterSpacing */}
            {props.code}
          </Kb.Text>
        )}
      </Kb.PlainInput>
      <Kb.ClickableBox
        onClick={props.resendWaiting || resendDisabled ? undefined : onResend}
        style={styles.positionRelative}
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
            color={Kb.Styles.globalColors.white}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        color: Kb.Styles.globalColors.white,
        flex: 1,
      },
      body: Kb.Styles.platformStyles({
        isMobile: {
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      container: {backgroundColor: Kb.Styles.globalColors.blue},
      headerContainer: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
        backgroundColor: Kb.Styles.globalColors.blue,
        position: 'relative',
      },
      headerText: {color: Kb.Styles.globalColors.black_50},
      iconVerticalAlign: Kb.Styles.platformStyles({
        isElectron: {
          position: 'relative',
          top: 1,
        },
      }),
      input: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueDark,
          borderRadius: Kb.Styles.borderRadius,
          color: Kb.Styles.globalColors.white,
          letterSpacing: 20,
          textAlign: 'center',
        },
        isElectron: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.xsmall),
          fontVariantLigatures: 'none', // ligatures interfere with letterSpacing
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
      inputText: Kb.Styles.platformStyles({
        isMobile: {
          color: Kb.Styles.globalColors.white,
          letterSpacing: 20,
          lineHeight: 28, // arrived at by fiddling - doesn't affect android
        },
      }),
      opacity30: {opacity: 0.3},
      positionRelative: {position: 'relative'},
      progressContainer: Kb.Styles.platformStyles({
        common: {...Kb.Styles.globalStyles.fillAbsolute},
        isElectron: {paddingTop: Kb.Styles.globalMargins.tiny},
      }),
      resend: Kb.Styles.platformStyles({
        isElectron: {
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)

export default VerifyPhoneNumber
