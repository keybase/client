import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import PhoneInput from '../../signup/phone-number/phone-input'
import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  forgotUsernameResult: string
  onBack: () => void
  onSubmit: (email: string, phone: string) => void
  waiting: boolean
}

const ForgotUsername = (props: Props) => {
  const [emailSelected, setEmailSelected] = React.useState(true)
  const [email, setEmail] = React.useState('')
  // PhoneInput's callback gets passed a (phoneNumber, valid) tuple.
  // If "valid" is false, phoneNumber gets set to null, therefore phoneNumber is only
  // truthy when it's valid. This is used in the form validation logic in the code.
  const [phoneNumber, setPhoneNumber] = React.useState<string | null>(null)
  const {onSubmit} = props
  const _onSubmit = React.useCallback(() => {
    if (!emailSelected && phoneNumber) {
      onSubmit('', phoneNumber)
    } else if (emailSelected) {
      onSubmit(email, '')
    }
  }, [onSubmit, email, phoneNumber, emailSelected])

  const error = props.forgotUsernameResult !== 'success' ? props.forgotUsernameResult : ''
  const disabled = (!emailSelected && phoneNumber === null) || (emailSelected && !email)

  return (
    <SignupScreen
      banners={[
        ...errorBanner(error),
        ...(props.forgotUsernameResult === 'success'
          ? [
              <Kb.Banner key="successBanner" color="blue">
                <Kb.BannerParagraph bannerColor="green" content="We just sent you your username." />
              </Kb.Banner>,
            ]
          : []),
      ]}
      buttons={[
        {
          disabled,
          label: 'Recover username',
          onClick: _onSubmit,
          type: 'Default',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
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
            onEnterKeyDown={_onSubmit}
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
          <PhoneInput
            autoFocus={true}
            onChangeNumber={(phoneNumber, valid) => {
              if (!valid) {
                setPhoneNumber(null)
                return
              }

              setPhoneNumber(phoneNumber)
            }}
            onEnterKeyDown={_onSubmit}
            style={styles.phoneInput}
          />
        )}
      </Kb.Box2>
    </SignupScreen>
  )
}

ForgotUsername.navigationOptions = {
  header: null,
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
