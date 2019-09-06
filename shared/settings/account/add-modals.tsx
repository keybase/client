import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as Platform from '../../constants/platform'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as SettingsGen from '../../actions/settings-gen'
import {EnterEmailBody} from '../../signup/email'
import {EnterPhoneNumberBody} from '../../signup/phone-number'
import {VerifyBody} from '../../signup/phone-number/verify'
import {e164ToDisplay} from '../../util/phone-numbers'

export const Email = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [email, onChangeEmail] = React.useState('')
  const [searchable, onChangeSearchable] = React.useState(true)
  const [addEmailInProgress, onAddEmailInProgress] = React.useState('')
  const emailTrimmed = email.trim()
  const disabled = !emailTrimmed

  const addedEmail = Container.useSelector(state => state.settings.email.addedEmail)
  const emailError = Container.useSelector(state => state.settings.email.error)
  const waiting = Container.useAnyWaiting(Constants.addEmailWaitingKey)

  // clean on unmount
  React.useEffect(() => () => dispatch(SettingsGen.createClearAddingEmail()), [dispatch])
  // watch for + nav away on success
  React.useEffect(() => {
    if (addedEmail === addEmailInProgress) {
      // success
      dispatch(RouteTreeGen.createClearModals())
    }
  }, [addEmailInProgress, addedEmail, dispatch])
  // clean on edit
  React.useEffect(() => {
    if (emailTrimmed !== addEmailInProgress && emailError) {
      dispatch(SettingsGen.createClearAddingEmail())
    }
  }, [addEmailInProgress, dispatch, emailError, emailTrimmed])

  const onClose = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const onContinue = React.useCallback(() => {
    if (disabled || waiting) {
      return
    }
    onAddEmailInProgress(emailTrimmed)
    dispatch(SettingsGen.createAddEmail({email: emailTrimmed, searchable: searchable}))
  }, [disabled, waiting, emailTrimmed, dispatch, searchable])
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodySemiboldLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : null,
        title: Styles.isMobile ? 'Add email address' : 'Add an email address',
      }}
      footer={{
        content: (
          <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
            {!Styles.isMobile && (
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
            Styles.isMobile
              ? Platform.isLargeScreen
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
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [phoneNumber, onChangeNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const [searchable, onChangeSearchable] = React.useState(true)
  const disabled = !valid

  const error = Container.useSelector(state => state.settings.phoneNumbers.error)
  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const waiting = Container.useAnyWaiting(Constants.addPhoneNumberWaitingKey)

  // clean only errors on unmount so verify screen still has info
  React.useEffect(() => () => dispatch(SettingsGen.createClearPhoneNumberErrors()), [dispatch])
  // watch for go to verify
  React.useEffect(() => {
    if (!error && !!pendingVerification) {
      dispatch(nav.safeNavigateAppendPayload({path: ['settingsVerifyPhone']}))
    }
  }, [dispatch, error, nav, pendingVerification])

  const onClose = React.useCallback(() => {
    dispatch(SettingsGen.createClearPhoneNumberAdd())
    dispatch(nav.safeNavigateUpPayload())
  }, [dispatch, nav])

  const onContinue = React.useCallback(
    () =>
      disabled || waiting ? null : dispatch(SettingsGen.createAddPhoneNumber({phoneNumber, searchable})),
    [dispatch, disabled, waiting, searchable, phoneNumber]
  )

  const onChangeNumberCb = React.useCallback((phoneNumber: string, validity: boolean) => {
    onChangeNumber(phoneNumber)
    onChangeValidity(validity)
  }, [])

  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodySemiboldLink" onClick={onClose}>
            Close
          </Kb.Text>
        ) : null,
        title: Styles.isMobile ? 'Add phone number' : 'Add a phone number',
      }}
      footer={{
        content: (
          <Kb.ButtonBar style={styles.buttonBar} fullWidth={true}>
            {!Styles.isMobile && (
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
          onChangeNumber={onChangeNumberCb}
          onContinue={onContinue}
          searchable={searchable}
          onChangeSearchable={onChangeSearchable}
          iconType={
            Styles.isMobile
              ? Platform.isLargeScreen
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
  const dispatch = Container.useDispatch()

  const [code, onChangeCode] = React.useState('')

  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const error = Container.useSelector(state => state.settings.phoneNumbers.error)
  const verificationState = Container.useSelector(state => state.settings.phoneNumbers.verificationState)
  const resendWaiting = Container.useAnyWaiting(
    Constants.addPhoneNumberWaitingKey,
    Constants.resendVerificationForPhoneWaitingKey
  )
  const verifyWaiting = Container.useAnyWaiting(Constants.verifyPhoneNumberWaitingKey)

  // clean everything on unmount
  React.useEffect(() => () => dispatch(SettingsGen.createClearPhoneNumberAdd()), [dispatch])
  // Clear on success
  React.useEffect(() => {
    if (verificationState === 'success' && !error) {
      dispatch(RouteTreeGen.createClearModals())
    }
  }, [verificationState, error, dispatch])

  const onResend = React.useCallback(
    () => dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber: pendingVerification})),
    [dispatch, pendingVerification]
  )
  const onClose = React.useCallback(() => {
    dispatch(SettingsGen.createClearPhoneNumberAdd())
    dispatch(RouteTreeGen.createClearModals())
  }, [dispatch])
  const onContinue = React.useCallback(
    () => dispatch(SettingsGen.createVerifyPhoneNumber({code, phoneNumber: pendingVerification})),
    [dispatch, code, pendingVerification]
  )
  const disabled = !code

  const displayPhone = e164ToDisplay(pendingVerification)
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        hideBorder: true,
        leftButton: Styles.isMobile ? (
          <Kb.BackButton onClick={onClose} iconColor={Styles.globalColors.white} />
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
        style={Styles.collapseStyles([
          styles.blueBackground,
          styles.verifyContainer,
          Styles.globalStyles.flexOne,
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      blueBackground: {
        backgroundColor: Styles.globalColors.blue,
      },
      body: {
        ...Styles.padding(
          Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xlarge,
          Styles.globalMargins.small,
          0
        ),
        backgroundColor: Styles.globalColors.blueGrey,
        flexGrow: 1,
        position: 'relative',
      },
      buttonBar: {
        minHeight: undefined,
      },
      footer: {
        ...Styles.padding(Styles.globalMargins.small),
      },
      verifyContainer: {
        ...Styles.padding(0, Styles.globalMargins.small),
      },
    } as const)
)
