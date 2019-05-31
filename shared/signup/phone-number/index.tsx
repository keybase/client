import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'
import PhoneInput from './phone-input'
import {ButtonType} from '../../common-adapters/button'

type Props = {
  allowSearch: boolean
  onChangeAllowSearch: (arg0: boolean) => void
  onChangePhoneNumber: (arg0: string) => void
  onChangeValidity: (arg0: boolean) => void
  onContinue: () => void
  onSkip: () => void
}

const EnterPhoneNumber = (props: Props) => (
  <SignupScreen
    buttons={[
      {label: 'Continue', onClick: props.onContinue, type: 'Success' as ButtonType},
      ...(Styles.isMobile ? [] : [{label: 'Skip for now', onClick: props.onSkip, type: 'Dim' as ButtonType}]),
    ]}
    rightActionLabel="Skip"
    onRightAction={props.onSkip}
    title="Your phone number"
  >
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile}>
      <PhoneInput
        style={styles.input}
        onChangeNumber={props.onChangePhoneNumber}
        onChangeValidity={props.onChangeValidity}
        error=""
      />
      <Kb.Checkbox
        label="Allow friends to find you by this phone number"
        checked={props.allowSearch}
        onCheck={props.onChangeAllowSearch}
        style={styles.checkbox}
      />
    </Kb.Box2>
  </SignupScreen>
)

const styles = Styles.styleSheetCreate({
  checkbox: {width: '100%'},
  input: Styles.platformStyles({
    isElectron: {
      height: 38,
      width: 368,
    },
    isMobile: {
      height: 48,
    },
  }),
})

export default EnterPhoneNumber
