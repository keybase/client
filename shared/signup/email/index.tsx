import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../common'
import {ButtonType} from '../../common-adapters/button'

type Props = {
  allowSearch: boolean
  onChangeAllowSearch: (arg0: boolean) => void
  onChangeEmail: (arg0: string) => void
  onFinish: () => void
  onSkip: () => void
}

const EnterEmail = (props: Props) => (
  <SignupScreen
    buttons={[
      {label: 'Finish', onClick: props.onFinish, type: 'Success'},
      ...(Styles.isMobile ? [] : [{label: 'Skip for now', onClick: props.onSkip, type: 'Dim' as ButtonType}]),
    ]}
    rightActionLabel="Skip"
    onRightAction={props.onSkip}
    title="Your email address"
  >
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={Styles.isMobile}>
      <Kb.NewInput
        autoFocus={true}
        containerStyle={styles.input}
        keyboardType="email-address"
        placeholder="Email address"
        onChangeText={props.onChangeEmail}
        textContentType="emailAddress"
      />
      <Kb.Checkbox
        label="Allow friends to find you by this email address"
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
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 38,
      width: 368,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      height: 48,
    },
  }),
})

export default EnterEmail
