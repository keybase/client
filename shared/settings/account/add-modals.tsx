import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import {EnterEmailBody} from '@/signup/email'
import {EnterPhoneNumberBody} from '@/signup/phone-number'
import VerifyBody from '@/signup/phone-number/verify-body'
import {useAddPhoneNumber, usePhoneVerification} from '@/signup/phone-number/use-verification'
import {useAddEmail} from './use-add-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useDefaultPhoneCountry} from '@/util/phone-numbers'
import {settingsAccountTab} from '@/constants/settings'

export const Email = () => {
  const nav = useSafeNavigation()

  const [email, onChangeEmail] = React.useState('')
  const [searchable, onChangeSearchable] = React.useState(true)
  const [submittedEmail, setSubmittedEmail] = React.useState('')
  const emailTrimmed = email.trim()
  const disabled = !emailTrimmed

  const {clearError, error: emailError, submitEmail, waiting} = useAddEmail()

  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend

  // clean on edit
  React.useEffect(() => {
    if (emailTrimmed !== submittedEmail && emailError) {
      clearError()
    }
  }, [clearError, emailError, emailTrimmed, submittedEmail])

  const onClose = () => nav.safeNavigateUp()
  const onContinue = () => {
    if (disabled || waiting) {
      return
    }
    setSubmittedEmail(emailTrimmed)
    submitEmail(emailTrimmed, searchable, addedEmail => {
      clearModals()
      // Wait for the modal reset so replace=true updates the account route instead of duplicating it.
      setTimeout(() => {
        navigateAppend({name: settingsAccountTab, params: {addedEmailBannerEmail: addedEmail}}, true)
      }, 0)
    })
  }
  return (
    <>
      {!!emailError && (
        <Kb.Banner color="red" style={styles.banner}>
          <Kb.BannerParagraph bannerColor="red" content={emailError} />
        </Kb.Banner>
      )}
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
        flex={1}
        relative={true}
        style={styles.body}
      >
        <EnterEmailBody
          email={email}
          onChangeEmail={onChangeEmail}
          showSearchable={true}
          searchable={searchable}
          onChangeSearchable={onChangeSearchable}
          onContinue={onContinue}
          iconType={
            Kb.Styles.isMobile
              ? C.isLargeScreen
                ? 'icon-email-add-96'
                : 'icon-email-add-64'
              : 'icon-email-add-64'
          }
        />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.modalFooter, styles.footer])}
      >
        <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
          {!Kb.Styles.isMobile && (
            <Kb.Button type="Dim" label="Cancel" fullWidth={true} onClick={onClose} disabled={waiting} />
          )}
          <Kb.Button
            label="Continue"
            fullWidth={true}
            onClick={onContinue}
            disabled={disabled}
            waiting={waiting}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}
export const Phone = () => {
  const nav = useSafeNavigation()

  const [phoneNumber, onChangeNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !valid

  const defaultCountry = useDefaultPhoneCountry()
  const {clearError, error, submitPhoneNumber, waiting} = useAddPhoneNumber()

  const onClose = () => {
    nav.safeNavigateUp()
  }

  const onContinue = () => {
    if (disabled || waiting) {
      return
    }
    submitPhoneNumber(phoneNumber, searchable, submittedPhoneNumber => {
      nav.safeNavigateAppend({
        name: 'settingsVerifyPhone',
        params: {initialResend: false, phoneNumber: submittedPhoneNumber},
      })
    })
  }

  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
    if (error) {
      clearError()
    }
    onChangeNumber(phoneNumber)
    onChangeValidity(validity)
  }

  return (
    <>
      {!!error && (
        <Kb.Banner color="red" style={styles.banner}>
          <Kb.BannerParagraph bannerColor="red" content={error} />
        </Kb.Banner>
      )}
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
        flex={1}
        relative={true}
        style={styles.body}
      >
        <EnterPhoneNumberBody
          defaultCountry={defaultCountry}
          onChangeNumber={onChangeNumberCb}
          onContinue={onContinue}
          searchable={searchable}
          onChangeSearchable={onChangeSearchable}
          iconType={
            Kb.Styles.isMobile
              ? C.isLargeScreen
                ? 'icon-phone-number-add-96'
                : 'icon-phone-number-add-64'
              : 'icon-phone-number-add-64'
          }
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={Kb.Styles.collapseStyles([styles.modalFooter, styles.footer])}>
          <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
            {!Kb.Styles.isMobile && (
              <Kb.Button type="Dim" label="Cancel" fullWidth={true} onClick={onClose} disabled={waiting} />
            )}
            <Kb.Button
              label="Continue"
              fullWidth={true}
              onClick={onContinue}
              disabled={disabled}
              waiting={waiting}
            />
          </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}
type VerifyPhoneProps = {
  initialResend?: boolean
  phoneNumber: string
}

export const VerifyPhone = ({initialResend, phoneNumber}: VerifyPhoneProps) => {
  const [code, onChangeCode] = React.useState('')

  const setAddedPhone = useSettingsPhoneState(s => s.dispatch.setAddedPhone)
  const clearModals = C.Router2.clearModals
  const {error, resendVerificationForPhone, verifyPhoneNumber} = usePhoneVerification({
    initialResend,
    onSuccess: () => {
      setAddedPhone(true)
      clearModals()
    },
    phoneNumber,
  })
  const resendWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneResendVerification)
  const verifyWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneVerifyPhoneNumber)

  const onResend = () => {
    resendVerificationForPhone(phoneNumber)
  }
  const onContinue = () => verifyPhoneNumber(phoneNumber, code)
  const disabled = !code

  return (
    <>
      {!!error && (
        <Kb.Banner color="red" style={styles.banner}>
          <Kb.BannerParagraph bannerColor="red" content={error} />
        </Kb.Banner>
      )}
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          styles.blueBackground,
          styles.verifyContainer,
          Kb.Styles.globalStyles.flexOne,
        ])}
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
      >
        <VerifyBody
          onResend={onResend}
          resendWaiting={resendWaiting}
          code={code}
          onChangeCode={onChangeCode}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={Kb.Styles.collapseStyles([styles.modalFooterNoBorder, styles.blueBackground])}>
          <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
            <Kb.Button
              disabled={disabled}
              type="Success"
              label="Continue"
              onClick={onContinue}
              waiting={verifyWaiting}
              fullWidth={true}
            />
          </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      blueBackground: {
        backgroundColor: Kb.Styles.globalColors.blue,
      },
      body: {
        ...Kb.Styles.padding(
          Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : Kb.Styles.globalMargins.xlarge,
          Kb.Styles.globalMargins.small,
          0
        ),
        backgroundColor: Kb.Styles.globalColors.blueGrey,
      },
      buttonBar: {
        minHeight: undefined,
      },
      footer: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
      modalFooterNoBorder: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
      verifyContainer: {
        ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
      },
    }) as const
)
