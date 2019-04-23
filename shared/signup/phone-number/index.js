// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'
import PhoneInput from './phone-input'

type Props = {|
  allowSearch: boolean,
  onChangeAllowSearch: boolean => void,
  onChangePhoneNumber: string => void,
  onChangeValidity: boolean => void,
  onContinue: () => void,
  onSkip: () => void,
|}

const EnterPhoneNumber = (props: Props) => (
  <SignupScreen
    buttons={[
      {label: 'Continue', onClick: props.onContinue, type: 'Success'},
      ...(Styles.isMobile ? [] : [{label: 'Skip for now', onClick: props.onSkip, type: 'Dim'}]),
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
        error={props.numberValid}
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
