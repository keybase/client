import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'

const todo = () => console.log('todo')

const KnowPassword = () => (
  <SignupScreen
    title="Account reset"
    noBackground={true}
    onBack={todo}
    leftActionText="Cancel"
    buttons={[{label: 'Yes', type: 'Success', onClick: todo}, {label: 'No', type: 'Dim', onClick: todo}]}
  >
    <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.Icon type="iconfont-password" color={Styles.globalColors.black} fontSize={24} />
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="Header" center={true}>
          Do you know your
        </Kb.Text>
        <Kb.Text type="Header">password?</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </SignupScreen>
)

const EnterPassword = () => (
  <SignupScreen title="Your password" onBack={todo} buttons={[{label: 'Continue', onClick: todo}]}>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.LabeledInput placeholder="Enter your password" containerStyle={styles.input} type="password" />
    </Kb.Box2>
  </SignupScreen>
)

const styles = Styles.styleSheetCreate(() => ({
  input: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
}))

export {EnterPassword, KnowPassword}
