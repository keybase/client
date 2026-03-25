import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useRouteNavigation} from '@/constants/router'
import {EnterEmailBody} from '@/signup/email'
import {EnterPhoneNumberBody} from '@/signup/phone-number'
import VerifyBody from '@/signup/phone-number/verify-body'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'

export const Email = () => {
  const nav = useRouteNavigation()

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

  const onClose = () => nav.navigateUp()
  const onContinue = () => {
    if (disabled || waiting) {
      return
    }
    onAddEmailInProgress(emailTrimmed)
    addEmail(emailTrimmed, searchable)
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
export const Phone = () => {
  const nav = useRouteNavigation()

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
      nav.navigateAppend('settingsVerifyPhone')
    }
  }, [error, nav, pendingVerification])
  // trigger a default phone number country rpc if it's not already loaded
  React.useEffect(() => {
    !defaultCountry && loadDefaultPhoneCountry()
  }, [defaultCountry, loadDefaultPhoneCountry])

  const onClose = () => {
    clearPhoneNumberAdd()
    nav.navigateUp()
  }

  const onContinue = () => {
    disabled || waiting ? null : addPhoneNumber(phoneNumber, searchable)
  }

  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
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

  const onResend = () => {
    resendVerificationForPhone(pendingVerification)
  }
  const onContinue = () => verifyPhoneNumber(pendingVerification, code)
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
