import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '../common'
import {e164ToDisplay} from '@/util/phone-numbers'
import VerifyBody from './verify-body'
import {usePhoneVerification} from './use-verification'

type Props = {route: {params: {phoneNumber: string}}}

const Container = ({route}: Props) => {
  const {phoneNumber} = route.params
  const resendWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneResendVerification)
  const verifyWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneVerifyPhoneNumber)
  const onSuccess = C.useRouterState(s => s.dispatch.clearModals)
  const {error, resendVerificationForPhone, verifyPhoneNumber} = usePhoneVerification({
    onSuccess,
    phoneNumber,
  })

  const _onContinue = (phoneNumber: string, code: string) => {
    verifyPhoneNumber(phoneNumber, code)
  }
  const _onResend = (phoneNumber: string) => {
    resendVerificationForPhone(phoneNumber)
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const ponContinue = (code: string) => _onContinue(phoneNumber, code)
  const onResend = () => _onResend(phoneNumber)

  const [code, onChangeCode] = React.useState('')
  const disabled = !code
  const onContinue = disabled
    ? () => {}
    : () => {
        ponContinue(code)
      }

  const displayPhone = e164ToDisplay(phoneNumber)
  return (
    <SignupScreen
      onBack={onBack}
      banners={
        error ? (
          <Kb.Banner key="error" color="red">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
      buttons={[{label: 'Continue', onClick: onContinue, type: 'Success', waiting: verifyWaiting}]}
      titleComponent={
        <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
          {displayPhone}
        </Kb.Text>
      }
      containerStyle={styles.container}
      headerStyle={styles.container}
      header={
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" relative={true} style={styles.headerContainer}>
          <Kb.Text type="BodyBigLink" style={styles.backButton} onClick={onBack}>
            Back
          </Kb.Text>
          <Kb.Text type="BodyTinySemibold" style={styles.headerText} center={true}>
            {displayPhone}
          </Kb.Text>
          <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne} />
        </Kb.Box2>
      }
      negativeHeader={true}
      showHeaderInfoicon={true}
    >
      <VerifyBody onChangeCode={onChangeCode} code={code} onResend={onResend} resendWaiting={resendWaiting} />
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        color: Kb.Styles.globalColors.white,
        flex: 1,
      },
      container: {backgroundColor: Kb.Styles.globalColors.blue},
      headerContainer: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
        backgroundColor: Kb.Styles.globalColors.blue,
      },
      headerText: {color: Kb.Styles.globalColors.black_50},
    }) as const
)

export default Container
