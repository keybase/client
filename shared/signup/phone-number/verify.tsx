import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from '../common'
import {e164ToDisplay} from '@/util/phone-numbers'
import VerifyBody from './verify-body'
import {useSettingsPhoneState} from '@/stores/settings-phone'

const Container = () => {
  const {clearPhoneNumberAdd, error, phoneNumber, resendVerificationForPhone, verificationStatus, verifyPhoneNumber} =
    useSettingsPhoneState(
      C.useShallow(s => ({
        clearPhoneNumberAdd: s.dispatch.clearPhoneNumberAdd,
        error: s.verificationState === 'error' ? s.error : '',
        phoneNumber: s.pendingVerification,
        resendVerificationForPhone: s.dispatch.resendVerificationForPhone,
        verificationStatus: s.verificationState,
        verifyPhoneNumber: s.dispatch.verifyPhoneNumber,
      }))
    )
  const resendWaiting = C.Waiting.useAnyWaiting([
    C.waitingKeySettingsPhoneResendVerification,
    C.waitingKeySettingsPhoneAddPhoneNumber,
  ])
  const verifyWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneVerifyPhoneNumber)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onSuccess = C.useRouterState(s => s.dispatch.clearModals)
  const onBack = () => navigateUp()

  React.useEffect(() => {
    if (verificationStatus === 'success') {
      onSuccess()
    }
  }, [verificationStatus, onSuccess])

  React.useEffect(() => {
    return () => {
      clearPhoneNumberAdd()
    }
  }, [clearPhoneNumberAdd])

  const [code, onChangeCode] = React.useState('')
  const onContinue = () => {
    if (!code) {
      return
    }

    verifyPhoneNumber(phoneNumber, code)
  }
  const onResend = () => resendVerificationForPhone(phoneNumber)

  const displayPhone = e164ToDisplay(phoneNumber)
  return (
    <SignupScreen
      onBack={onBack}
      banners={errorBanner(error)}
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
      showHeaderInfoIcon={true}
    >
      <VerifyBody onChangeCode={onChangeCode} onResend={onResend} resendWaiting={resendWaiting} />
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
