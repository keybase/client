import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen, errorBanner} from '../common'
import PhoneInput from './phone-input'
import {ButtonType} from '../../common-adapters/button'

export type Props = {
  error: string
  onContinue: (phoneNumber: string, allowSearch: boolean) => void
  onSkip: () => void
  waiting: boolean
}

const EnterPhoneNumber = (props: Props) => {
  const [phoneNumber, onChangePhoneNumber] = React.useState('')
  const [valid, onChangeValidity] = React.useState(false)
  // const [allowSearch, onChangeAllowSearch] = React.useState(true)
  const disabled = !valid
  const onContinue = () =>
    disabled || props.waiting ? {} : props.onContinue(phoneNumber, true /* allowSearch */)
  return (
    <SignupScreen
      buttons={[
        {
          disabled,
          label: 'Continue',
          onClick: onContinue,
          type: 'Success' as ButtonType,
          waiting: props.waiting,
        },
        ...(Styles.isMobile
          ? []
          : [
              {
                disabled: props.waiting,
                label: 'Skip for now',
                onClick: props.onSkip,
                type: 'Dim' as ButtonType,
              },
            ]),
      ]}
      banners={errorBanner(props.error)}
      rightActionLabel="Skip"
      onRightAction={props.onSkip}
      title="Your phone number"
      showHeaderInfoicon={true}
    >
      <EnterPhoneNumberBody
        // the push prompt might be overlaying us
        // TODO Y2K-57 move phone number earlier and check that email won't have this problem
        autoFocus={!Styles.isMobile}
        onChangeNumber={onChangePhoneNumber}
        onChangeValidity={onChangeValidity}
        onContinue={onContinue}
        allowSearch={true}
        icon={Styles.isMobile ? <Kb.Icon type="icon-phone-number-add-96" style={styles.icon} /> : null}
      />
    </SignupScreen>
  )
}

type BodyProps = {
  autoFocus: boolean
  onChangeNumber: (phoneNumber: string) => void
  onChangeValidity: (valid: boolean) => void
  onContinue: () => void
  allowSearch: boolean
  onChangeAllowSearch?: (allow: boolean) => void
  icon: React.ReactNode
}
export const EnterPhoneNumberBody = (props: BodyProps) => {
  const showCheckbox = !!props.onChangeAllowSearch
  return (
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      gap={Styles.isMobile ? 'small' : 'medium'}
      fullWidth={true}
      style={Styles.globalStyles.flexOne}
    >
      {props.icon}
      <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile} style={styles.inputBox}>
        <PhoneInput
          autoFocus={props.autoFocus}
          style={styles.input}
          onChangeNumber={props.onChangeNumber}
          onChangeValidity={props.onChangeValidity}
          onEnterKeyDown={props.onContinue}
        />
        {showCheckbox ? (
          <Kb.Checkbox
            label="Allow friends to find you by this phone number"
            checked={props.allowSearch}
            onCheck={props.onChangeAllowSearch || null}
            style={styles.checkbox}
          />
        ) : (
          <Kb.Text type="BodySmall">Allow your friends to find you.</Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}
EnterPhoneNumberBody.defaultProps = {
  autoFocus: true,
}

const styles = Styles.styleSheetCreate({
  checkbox: {width: '100%'},
  icon: {
    height: 96,
    width: 96,
  },
  input: Styles.platformStyles({
    isElectron: {
      height: 38,
      width: 368,
    },
    isMobile: {
      height: 48,
      width: '100%',
    },
  }),
  inputBox: Styles.platformStyles({
    isElectron: {
      // need to set width so subtext will wrap
      width: 368,
    },
  }),
})

export default EnterPhoneNumber
