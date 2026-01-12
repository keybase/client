import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from '../signup/common'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useProvisionState} from '@/stores/provision'

const ForgotUsername = () => {
  const defaultCountry = useSettingsPhoneState(s => s.defaultCountry)
  const loadDefaultPhoneCountry = useSettingsPhoneState(s => s.dispatch.loadDefaultPhoneCountry)
  // trigger a default phone number country rpc if it's not already loaded
  React.useEffect(() => {
    !defaultCountry && loadDefaultPhoneCountry()
  }, [defaultCountry, loadDefaultPhoneCountry])

  const forgotUsernameResult = useProvisionState(s => s.forgotUsernameResult)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvisionForgotUsername)

  const [emailSelected, setEmailSelected] = React.useState(true)
  const [email, setEmail] = React.useState('')
  // PhoneInput's callback gets passed a (phoneNumber, valid) tuple.
  // If "valid" is false, phoneNumber gets set to null, therefore phoneNumber is only
  // truthy when it's valid. This is used in the form validation logic in the code.
  const [phoneNumber, setPhoneNumber] = React.useState<string | undefined>()

  const forgotUsername = useProvisionState(s => s.dispatch.forgotUsername)

  const onSubmit = React.useCallback(() => {
    if (!emailSelected && phoneNumber) {
      forgotUsername(phoneNumber)
    } else if (emailSelected) {
      forgotUsername(undefined, email)
    }
  }, [forgotUsername, email, phoneNumber, emailSelected])

  const error = forgotUsernameResult !== 'success' ? forgotUsernameResult : ''
  const disabled = (!emailSelected && phoneNumber === undefined) || (emailSelected && !email)

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
                setPhoneNumber(undefined)
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  phoneInput: Kb.Styles.platformStyles({
    isElectron: {
      height: 38,
      width: '100%',
    },
    isMobile: {
      height: 48,
      width: '100%',
    },
  }),
  wrapper: Kb.Styles.platformStyles({
    isElectron: {
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
}))

export default ForgotUsername
