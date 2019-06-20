import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'
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
  const [allowSearch, onChangeAllowSearch] = React.useState(false)
  const disabled = !valid
  const onContinue = () => (disabled || props.waiting ? {} : props.onContinue(phoneNumber, allowSearch))
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
      rightActionLabel="Skip"
      onRightAction={props.onSkip}
      title="Your phone number"
      showHeaderInfoicon={true}
    >
      <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile} style={styles.inputBox}>
        <PhoneInput
          style={styles.input}
          onChangeNumber={onChangePhoneNumber}
          onChangeValidity={onChangeValidity}
          onEnterKeyDown={onContinue}
        />
        <Kb.Checkbox
          label="Allow friends to find you by this phone number"
          checked={allowSearch}
          onCheck={onChangeAllowSearch}
          style={styles.checkbox}
        />
        {!!props.error && <Kb.Text type="BodySmallError">{props.error}</Kb.Text>}
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate({
  checkbox: {width: '100%'},
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
