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
  // clean on unmount
  React.useEffect(() => () => dispatch(SettingsGen.createClearAddingEmail()), [dispatch])

  // watch for + nav away on success
  const addedEmail = Container.useSelector(state => state.settings.email.addedEmail)
  React.useEffect(() => {
    if (addedEmail) {
      // success
      dispatch(RouteTreeGen.createClearModals())
    }
  }, [addedEmail, dispatch])

  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const [email, onChangeEmail] = React.useState('')
  const [allowSearch, onChangeAllowSearch] = React.useState(true)
  const emailError = Container.useSelector(state => state.settings.email.error)
  const disabled = !email
  const waiting = Container.useAnyWaiting(Constants.addEmailWaitingKey)
  const onContinue = React.useCallback(
    () =>
      disabled || waiting ? null : dispatch(SettingsGen.createAddEmail({email, searchable: allowSearch})),
    [dispatch, disabled, email, allowSearch, waiting]
  )
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
          icon={<Kb.Icon type={Styles.isMobile ? 'icon-email-add-64' : 'icon-email-add-48'} />}
        />
      </Kb.Box2>
      {!!emailError && <Kb.Banner color="red" text={emailError.message} style={styles.banner} />}
    </Kb.Modal>
  )
}
export const Phone = () => {
  const dispatch = Container.useDispatch()
  // clean only errors on unmount so verify screen still has info
  React.useEffect(() => () => dispatch(SettingsGen.createClearPhoneNumberErrors()), [dispatch])
  // watch for go to verify
  const error = Container.useSelector(state => state.settings.phoneNumbers.error)
  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  React.useEffect(() => {
    if (!error && !!pendingVerification) {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsVerifyPhone']}))
    }
  }, [dispatch, error, pendingVerification])

  const onClose = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const [phoneNumber, onChangeNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  const [allowSearch, onChangeAllowSearch] = React.useState(false)
  const waiting = Container.useAnyWaiting(Constants.addPhoneNumberWaitingKey)
  const disabled = !valid
  const onContinue = React.useCallback(
    () =>
      // TODO switch back to add
      disabled || waiting ? null : dispatch(SettingsGen.createAddedPhoneNumber({allowSearch, phoneNumber})),
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
              type={Styles.isMobile ? 'icon-number-add-64' : 'icon-number-add-48'}
              style={styles.numberIcon}
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
  // clean everything on unmount
  React.useEffect(() => () => dispatch(SettingsGen.createClearPhoneNumberAdd()), [dispatch])
  const onClose = React.useCallback(() => {
    dispatch(SettingsGen.createClearPhoneNumberAdd())
    dispatch(RouteTreeGen.createClearModals())
  }, [dispatch])
  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const onResend = React.useCallback(
    () => dispatch(SettingsGen.createAddPhoneNumber({allowSearch: false, phoneNumber: '', resend: true})),
    [dispatch]
  )
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        hideBorder: true,
        style: styles.blueBackground,
        title: <Kb.Text type="BodySmall">{pendingVerification || 'wut'}</Kb.Text>,
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
        <VerifyBody />
      </Kb.Box2>
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
  numberIcon: Styles.platformStyles({
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
