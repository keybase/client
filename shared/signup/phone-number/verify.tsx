import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '../common'
import VerifyBody from './verify-body'
import {usePhoneVerification} from './use-verification'

type Props = {route: {params: {phoneNumber: string}}}

const VerifyPhoneNumber = ({route}: Props) => {
  const styles = useStyles()
  const {phoneNumber} = route.params
  const resendWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneResendVerification)
  const verifyWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneVerifyPhoneNumber)
  const onSuccess = C.Router2.clearModals
  const {error, resendVerificationForPhone, verifyPhoneNumber} = usePhoneVerification({
    onSuccess,
    phoneNumber,
  })

  const onResend = () => resendVerificationForPhone(phoneNumber)

  const [code, onChangeCode] = React.useState('')
  const disabled = !code
  const onContinue = disabled
    ? () => {}
    : () => {
        verifyPhoneNumber(phoneNumber, code)
      }

  return (
    <SignupScreen
      banners={
        error ? (
          <Kb.Banner key="error" color="red">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
      buttons={[{label: 'Continue', onClick: onContinue, type: 'Success', waiting: verifyWaiting}]}
      containerStyle={styles.container}
    >
      <VerifyBody onChangeCode={onChangeCode} code={code} onResend={onResend} resendWaiting={resendWaiting} />
    </SignupScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  container: {backgroundColor: theme.blue},
}))

export default VerifyPhoneNumber
