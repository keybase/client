import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

export type Props = {
  onContinue: (choice: boolean) => void
}

const ResetPassword = (props: Props) => {
  return (
    <SignupScreen
      buttons={[
        {
          label: 'Reset password',
          onClick: () => props.onContinue(true),
          type: 'Default' as ButtonType,
        },
      ]}
      onBack={() => props.onContinue(false)}
      title="Reset password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="medium">
        <Kb.Icon type="iconfont-skull" sizeType="Bigger" />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body">If you have forgotten your password you can reset your password.</Kb.Text>
          <Kb.Text type="Body">You will keep your username, but lose all your data,</Kb.Text>
          <Kb.Text type="Body">including all of your uploaded encrypted PGP keys.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

ResetPassword.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ResetPassword
