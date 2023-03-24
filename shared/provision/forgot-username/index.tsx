import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import * as SettingsGen from '../../actions/settings-gen'
import {SignupScreen, errorBanner} from '../../signup/common'

const ForgotUsername = () => {
  const dispatch = Container.useDispatch()

  const defaultCountry = Container.useSelector(state => state.settings.phoneNumbers.defaultCountry)
  // trigger a default phone number country rpc if it's not already loaded
  React.useEffect(() => {
    !defaultCountry && dispatch(SettingsGen.createLoadDefaultPhoneNumberCountry())
  }, [defaultCountry, dispatch])

  const forgotUsernameResult = Container.useSelector(state => state.provision.forgotUsernameResult)
  const onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const waiting = Container.useAnyWaiting(Constants.forgotUsernameWaitingKey)

  const [emailSelected, setEmailSelected] = React.useState(true)
  const [email, setEmail] = React.useState('')
  // PhoneInput's callback gets passed a (phoneNumber, valid) tuple.
  // If "valid" is false, phoneNumber gets set to null, therefore phoneNumber is only
  // truthy when it's valid. This is used in the form validation logic in the code.
  const [phoneNumber, setPhoneNumber] = React.useState<string | null>(null)
  const onSubmit = React.useCallback(() => {
    if (!emailSelected && phoneNumber) {
      dispatch(ProvisionGen.createForgotUsername({phone: phoneNumber}))
    } else if (emailSelected) {
      dispatch(ProvisionGen.createForgotUsername({email}))
    }
  }, [dispatch, email, phoneNumber, emailSelected])

  const error = forgotUsernameResult !== 'success' ? forgotUsernameResult : ''
  const disabled = (!emailSelected && phoneNumber === null) || (emailSelected && !email)

  return (
    <SignupScreen
      banners={
        <>
          {errorBanner(error)}
          {forgotUsernameResult === 'success' ? (
            <Kb.Banner key="successBanner" color="blue">
              <Kb.BannerParagraph bannerColor="green" content="We just sent you your username." />
            </Kb.Banner>
          ) : null}
        </>
      }
      buttons={[
        {
          disabled,
          label: 'Recover username',
          onClick: onSubmit,
          type: 'Default',
          waiting: waiting,
        },
      ]}
      onBack={onBack}
      title="Recover username"
    >
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.wrapper}>
        <Kb.RadioButton
          label="Recover with email"
          onSelect={() => setEmailSelected(true)}
          selected={emailSelected}
        />
        {emailSelected && (
          <Kb.LabeledInput
            autoFocus={true}
            placeholder="Email address"
            onEnterKeyDown={onSubmit}
            onChangeText={setEmail}
            value={email}
          />
        )}
        <Kb.RadioButton
          label="Recover with phone number"
          onSelect={() => setEmailSelected(false)}
          selected={!emailSelected}
        />
        {!emailSelected && (
          <Kb.PhoneInput
            autoFocus={true}
            defaultCountry={defaultCountry}
            onChangeNumber={(phoneNumber, valid) => {
              if (!valid) {
                setPhoneNumber(null)
                return
              }

              setPhoneNumber(phoneNumber)
            }}
            onEnterKeyDown={onSubmit}
            style={styles.phoneInput}
          />
        )}
      </Kb.Box2>
    </SignupScreen>
  )
}

ForgotUsername.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

const styles = Styles.styleSheetCreate(() => ({
  phoneInput: Styles.platformStyles({
    isElectron: {
      height: 38,
      width: '100%',
    },
    isMobile: {
      height: 48,
      width: '100%',
    },
  }),
  wrapper: Styles.platformStyles({
    isElectron: {
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
}))

export default ForgotUsername
