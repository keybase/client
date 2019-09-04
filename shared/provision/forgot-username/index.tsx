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
  const [emailSelected, _setEmailSelected] = React.useState(true)
  const [phoneSelected, _setPhoneSelected] = React.useState(false)
  const setEmailSelected = React.useCallback(
    (newState: boolean) => {
      _setEmailSelected(newState)
      _setPhoneSelected(!newState)
    },
    [_setEmailSelected, _setPhoneSelected]
  )
  const setPhoneSelected = React.useCallback(
    (newState: boolean) => {
      _setEmailSelected(!newState)
      _setPhoneSelected(newState)
    },
    [_setEmailSelected, _setPhoneSelected]
  )

  const [email, setEmail] = React.useState('')
  const [phoneNumber, setPhoneNumber] = React.useState<string | null>(null)
  const {onSubmit} = props
  const _onSubmit = React.useCallback(() => {
    if (phoneSelected && phoneNumber) {
      onSubmit('', phoneNumber)
    } else if (emailSelected) {
      onSubmit(email, '')
    }
  }, [onSubmit, email, phoneNumber])

  const error = props.forgotUsernameResult !== 'success' ? props.forgotUsernameResult : ''
  const disabled = (phoneSelected && phoneNumber === null) || (emailSelected && !email)

  return (
    <SignupScreen
      banners={[
        ...errorBanner(error),
        ...(props.forgotUsernameResult === 'success'
          ? [
              <Kb.Banner color="blue">
                <Kb.BannerParagraph
                  bannerColor="blue"
                  content="A message with your username has been sent."
                />
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
        <Kb.RadioButton label="Recover with email" onSelect={setEmailSelected} selected={emailSelected} />
        {emailSelected && (
          <Kb.LabeledInput
            autoFocus={true}
            style={styles.emailInput}
            placeholder="Email address"
            onEnterKeyDown={_onSubmit}
            onChangeText={setEmail}
            value={email}
          />
        )}
        <Kb.RadioButton
          label="Recover with phone number"
          onSelect={setPhoneSelected}
          selected={phoneSelected}
        />
        {phoneSelected && (
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

const styles = Styles.styleSheetCreate({
  emailInput: Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
    },
  }),
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
})

export default ForgotUsername
