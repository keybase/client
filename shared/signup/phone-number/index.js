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
  onFinish: () => void,
  onSkip: () => void,
|}

const EnterPhoneNumber = (props: Props) => (
  <SignupScreen
    buttons={[
      {label: 'Finish', onClick: props.onFinish, type: 'PrimaryGreen'},
      ...(Styles.isMobile ? [] : [{label: 'Skip for now', onClick: props.onSkip, type: 'Secondary'}]),
    ]}
    rightActionLabel="Skip"
    onRightAction={props.onSkip}
    title="Your phone number"
  >
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile}>
      <PhoneInput style={styles.input} onChangeNumber={props.onChangePhoneNumber} error="" />
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
    common: {},
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
