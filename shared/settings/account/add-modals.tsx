import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import {EnterEmailBody} from '@/signup/email'
import {EnterPhoneNumberBody} from '@/signup/phone-number'
import VerifyBody from '@/signup/phone-number/verify-body'
import {e164ToDisplay} from '@/util/phone-numbers'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'

export const Email = () => {
  const nav = useSafeNavigation()

  const [email, onChangeEmail] = React.useState('')
  const [searchable, onChangeSearchable] = React.useState(true)
  const [addEmailInProgress, onAddEmailInProgress] = React.useState('')
  const emailTrimmed = email.trim()
  const disabled = !emailTrimmed

  const {addedEmail, addEmail, emailError, resetAddingEmail} = useSettingsEmailState(
    C.useShallow(s => ({
      addEmail: s.dispatch.addEmail,
      addedEmail: s.addedEmail,
      emailError: s.error,
      resetAddingEmail: s.dispatch.resetAddingEmail,
    }))
  )
  const waiting = C.Waiting.useAnyWaiting(C.addEmailWaitingKey)

  // clean on unmount
  React.useEffect(
    () => () => {
      resetAddingEmail()
    },
    [resetAddingEmail]
  )

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)

  // watch for + nav away on success
  React.useEffect(() => {
    if (addedEmail && addedEmail === addEmailInProgress) {
      // success
      clearModals()
    }
  }, [addEmailInProgress, addedEmail, clearModals])
  // clean on edit
  React.useEffect(() => {
    if (emailTrimmed !== addEmailInProgress && emailError) {
      resetAddingEmail()
    }
  }, [addEmailInProgress, resetAddingEmail, emailError, emailTrimmed])

  const onClose = React.useCallback(() => nav.safeNavigateUp(), [nav])
  const onContinue = React.useCallback(() => {
    if (disabled || waiting) {
      return
    }
    onAddEmailInProgress(emailTrimmed)
    addEmail(emailTrimmed, searchable)
  }, [addEmail, disabled, waiting, emailTrimmed, searchable])
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodySemiboldLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : null,
        title: Kb.Styles.isMobile ? 'Add email address' : 'Add an email address',
      }}
      footer={{
        content: (
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
        ),
        style: styles.footer,
      }}
      mode="Wide"
    >
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
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
      {!!emailError && (
        <Kb.Banner color="red" style={styles.banner}>
          <Kb.BannerParagraph bannerColor="red" content={emailError} />
        </Kb.Banner>
      )}
    </Kb.Modal>
  )
}
export const Phone = () => {
  const nav = useSafeNavigation()

  const [phoneNumber, onChangeNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !valid

  const phoneState = useSettingsPhoneState(
    C.useShallow(s => ({
      addPhoneNumber: s.dispatch.addPhoneNumber,
      clearPhoneNumberAdd: s.dispatch.clearPhoneNumberAdd,
      clearPhoneNumberErrors: s.dispatch.clearPhoneNumberErrors,
      defaultCountry: s.defaultCountry,
      error: s.error,
      loadDefaultPhoneCountry: s.dispatch.loadDefaultPhoneCountry,
      pendingVerification: s.pendingVerification,
    }))
  )
  const {addPhoneNumber, clearPhoneNumberAdd, clearPhoneNumberErrors, defaultCountry} = phoneState
  const {error, loadDefaultPhoneCountry, pendingVerification} = phoneState
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneAddPhoneNumber)

  // clean only errors on unmount so verify screen still has info
  React.useEffect(
    () => () => {
      clearPhoneNumberErrors()
    },
    [clearPhoneNumberErrors]
  )
  // watch for go to verify
  React.useEffect(() => {
    if (!error && !!pendingVerification) {
      nav.safeNavigateAppend('settingsVerifyPhone')
    }
  }, [error, nav, pendingVerification])
  // trigger a default phone number country rpc if it's not already loaded
  React.useEffect(() => {
    !defaultCountry && loadDefaultPhoneCountry()
  }, [defaultCountry, loadDefaultPhoneCountry])

  const onClose = React.useCallback(() => {
    clearPhoneNumberAdd()
    nav.safeNavigateUp()
  }, [clearPhoneNumberAdd, nav])

  const onContinue = React.useCallback(() => {
    disabled || waiting ? null : addPhoneNumber(phoneNumber, searchable)
  }, [addPhoneNumber, disabled, waiting, searchable, phoneNumber])

  const onChangeNumberCb = React.useCallback((phoneNumber: string, validity: boolean) => {
    onChangeNumber(phoneNumber)
    onChangeValidity(validity)
  }, [])

  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodySemiboldLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : null,
        title: Kb.Styles.isMobile ? 'Add phone number' : 'Add a phone number',
      }}
      footer={{
        content: (
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
        ),
        style: styles.footer,
      }}
      mode="Wide"
    >
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
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
      {!!error && (
        <Kb.Banner color="red" style={styles.banner}>
          <Kb.BannerParagraph bannerColor="red" content={error} />
        </Kb.Banner>
      )}
    </Kb.Modal>
  )
}
export const VerifyPhone = () => {
  const [code, onChangeCode] = React.useState('')

  const phoneState = useSettingsPhoneState(
    C.useShallow(s => ({
      clearPhoneNumberAdd: s.dispatch.clearPhoneNumberAdd,
      error: s.error,
      pendingVerification: s.pendingVerification,
      resendVerificationForPhone: s.dispatch.resendVerificationForPhone,
      verificationState: s.verificationState,
      verifyPhoneNumber: s.dispatch.verifyPhoneNumber,
    }))
  )
  const {clearPhoneNumberAdd, error, pendingVerification} = phoneState
  const {resendVerificationForPhone, verificationState, verifyPhoneNumber} = phoneState
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const resendWaiting = C.Waiting.useAnyWaiting([
    C.waitingKeySettingsPhoneAddPhoneNumber,
    C.waitingKeySettingsPhoneResendVerification,
  ])
  const verifyWaiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneVerifyPhoneNumber)

  // clean everything on unmount
  React.useEffect(
    () => () => {
      clearPhoneNumberAdd()
    },
    [clearPhoneNumberAdd]
  )
  // Clear on success
  React.useEffect(() => {
    if (verificationState === 'success' && !error) {
      clearModals()
    }
  }, [verificationState, error, clearModals])

  const onResend = React.useCallback(() => {
    resendVerificationForPhone(pendingVerification)
  }, [resendVerificationForPhone, pendingVerification])
  const onClose = React.useCallback(() => {
    clearPhoneNumberAdd()
    clearModals()
  }, [clearPhoneNumberAdd, clearModals])
  const onContinue = React.useCallback(
    () => verifyPhoneNumber(pendingVerification, code),
    [verifyPhoneNumber, code, pendingVerification]
  )
  const disabled = !code

  const displayPhone = e164ToDisplay(pendingVerification)
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        hideBorder: true,
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Styles.CanFixOverdrawContext.Provider value={false}>
            <Kb.BackButton onClick={onClose} iconColor={Kb.Styles.globalColors.white} />
          </Kb.Styles.CanFixOverdrawContext.Provider>
        ) : null,
        style: styles.blueBackground,
        title: (
          <Kb.Text type="BodySmall" negative={true} center={true}>
            {displayPhone || 'Unknown number'}
          </Kb.Text>
        ),
      }}
      footer={{
        content: (
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
        ),
        hideBorder: true,
        style: styles.blueBackground,
      }}
      mode="Wide"
    >
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
      {!!error && (
        <Kb.Banner color="red" style={styles.banner}>
          <Kb.BannerParagraph bannerColor="red" content={error} />
        </Kb.Banner>
      )}
    </Kb.Modal>
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
        flexGrow: 1,
        position: 'relative',
      },
      buttonBar: {
        minHeight: undefined,
      },
      footer: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
      verifyContainer: {
        ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
      },
    }) as const
)
