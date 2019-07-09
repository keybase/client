import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as SettingsGen from '../../actions/settings-gen'
import {EnterEmailBody} from '../../signup/email/'
import {EnterPhoneNumberBody} from '../../signup/phone-number/'
import {VerifyBody} from '../../signup/phone-number/verify'
import {Props as HeaderHocProps} from '../../common-adapters/header-hoc/types'

export const Email = () => {
  const dispatch = Container.useDispatch()

  const [email, onChangeEmail] = React.useState('')
  const [allowSearch, onChangeAllowSearch] = React.useState(true)
  const [addEmailInProgress, onAddEmailInProgress] = React.useState('')
  const disabled = !email

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
  }, [addedEmail, dispatch])

  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onContinue = React.useCallback(() => {
    if (disabled || waiting) {
      return
    }
    onAddEmailInProgress(email)
    dispatch(SettingsGen.createAddEmail({email, searchable: allowSearch}))
  }, [dispatch, disabled, email, allowSearch, waiting])
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? <Kb.Icon type="iconfont-arrow-left" onClick={onClose} /> : null,
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
          showAllowSearch={true}
          allowSearch={allowSearch}
          onChangeAllowSearch={onChangeAllowSearch}
          onContinue={onContinue}
          icon={
            <Kb.Icon type={Styles.isMobile ? 'icon-email-add-64' : 'icon-email-add-48'} style={styles.icon} />
          }
        />
      </Kb.Box2>
      {!!emailError && <Kb.Banner color="red" text={emailError.message} style={styles.banner} />}
    </Kb.Modal>
  )
}
export const Phone = () => {
  const dispatch = Container.useDispatch()

  const [phoneNumber, onChangeNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const [allowSearch, onChangeAllowSearch] = React.useState(false)
  const disabled = !valid

  const error = Container.useSelector(state => state.settings.phoneNumbers.error)
  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const waiting = Container.useAnyWaiting(Constants.addPhoneNumberWaitingKey)

  // clean only errors on unmount so verify screen still has info
  React.useEffect(() => () => dispatch(SettingsGen.createClearPhoneNumberErrors()), [dispatch])
  // watch for go to verify
  React.useEffect(() => {
    if (!error && !!pendingVerification) {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsVerifyPhone']}))
    }
  }, [dispatch, error, pendingVerification])

  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onContinue = React.useCallback(
    () =>
      disabled || waiting ? null : dispatch(SettingsGen.createAddPhoneNumber({allowSearch, phoneNumber})),
    [dispatch, disabled, waiting, allowSearch, phoneNumber]
  )
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? <Kb.Icon type="iconfont-arrow-left" onClick={onClose} /> : null,
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
          onChangeNumber={onChangeNumber}
          onChangeValidity={onChangeValidity}
          onContinue={onContinue}
          allowSearch={allowSearch}
          onChangeAllowSearch={onChangeAllowSearch}
          icon={
            <Kb.Icon
              type={Styles.isMobile ? 'icon-phone-number-add-64' : 'icon-phone-number-add-48'}
              style={styles.icon}
            />
          }
        />
      </Kb.Box2>
      {!!error && <Kb.Banner color="red" text={error} style={styles.banner} />}
    </Kb.Modal>
  )
}
export const VerifyPhone = () => {
  const dispatch = Container.useDispatch()

  const [code, onChangeCode] = React.useState('')

  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const error = Container.useSelector(state => state.settings.phoneNumbers.error)
  const verificationState = Container.useSelector(state => state.settings.phoneNumbers.verificationState)
  const resendWaiting = Container.useAnyWaiting(Constants.addPhoneNumberWaitingKey)
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
    [dispatch]
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
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        hideBorder: true,
        style: styles.blueBackground,
        title: <Kb.Text type="BodySmall">{pendingVerification || 'wut'}</Kb.Text>,
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
      {!!error && <Kb.Banner color="red" text={error} style={styles.banner} />}
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate({
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
  icon: Styles.platformStyles({
    isElectron: {
      height: 48,
      width: 48,
    },
    isMobile: {
      height: 64,
      width: 64,
    },
  }),
  verifyContainer: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
})
