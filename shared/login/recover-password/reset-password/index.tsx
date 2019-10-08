import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

const ResetPassword = () => {
  const dispatch = Container.useDispatch()
  const onContinue = (action: boolean) => {
    dispatch(RecoverPasswordGen.createSubmitResetPrompt({action}))
  }

  return (
    <SignupScreen
      buttons={[
        {
          label: 'Send reset link',
          onClick: () => onContinue(true),
          type: 'Default' as ButtonType,
        },
      ]}
      noBackground={true}
      onBack={() => onContinue(false)}
      title="Reset password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="medium">
        <Kb.Icon type="iconfont-skull" sizeType="Bigger" />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body">If you have forgotten your password you can reset it here.</Kb.Text>
          <Kb.Text type="Body">You will keep your username, but lose all your encrypted data,</Kb.Text>
          <Kb.Text type="Body">including all of your uploaded private PGP keys.</Kb.Text>
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
