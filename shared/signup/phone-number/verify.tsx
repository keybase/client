import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'
import {e164ToDisplay} from '../../util/phone-numbers'

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
        props.error
          ? [
              <Kb.Banner key="error" color="red">
                <Kb.BannerParagraph bannerColor="red" content={props.error} />
              </Kb.Banner>,
            ]
          : []
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
          <Kb.Box2 direction="horizontal" style={Styles.globalStyles.flexOne} />
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
        <Kb.Text type="Header" style={styles.inputText}>
          {/* We put this child in Input because some text styles don't work on RN input itself - the one we need here is letterSpacing */}
          {props.code}
        </Kb.Text>
      </Kb.PlainInput>
      <Kb.ClickableBox onClick={props.onResend} style={styles.positionRelative}>
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          gap="tiny"
          style={Styles.collapseStyles([styles.resend, props.resendWaiting && styles.opacity30])}
        >
          <Kb.Icon
            type="iconfont-reload"
            color={Styles.globalColors.white}
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

const styles = Styles.styleSheetCreate({
  backButton: {
    color: Styles.globalColors.white,
    flex: 1,
  },
  body: Styles.platformStyles({
    isMobile: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  container: {backgroundColor: Styles.globalColors.blue},
  headerContainer: {
    ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.blue,
    position: 'relative',
  },
  headerText: {color: Styles.globalColors.black_50},
  iconVerticalAlign: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: 1,
    },
  }),
  input: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueDark,
      borderRadius: Styles.borderRadius,
      color: Styles.globalColors.white,
      letterSpacing: 20,
      textAlign: 'center',
    },
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      fontVariantLigatures: 'none', // ligatures interfere with letterSpacing
      height: 38,
      width: 368,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      minHeight: 48,
      width: '100%',
    },
  }),
  inputText: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.white,
      letterSpacing: 20,
      lineHeight: 28, // arrived at by fiddling - doesn't affect android
    },
  }),
  opacity30: {opacity: 0.3},
  positionRelative: {position: 'relative'},
  progressContainer: Styles.platformStyles({
    common: {...Styles.globalStyles.fillAbsolute},
    isElectron: {paddingTop: Styles.globalMargins.tiny},
  }),
  resend: Styles.platformStyles({
    isElectron: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
})

export default VerifyPhoneNumber
