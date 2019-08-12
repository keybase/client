import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {SignupScreen} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

export type Props = {
  onContinue: (choice: boolean) => void
}

const PromptReset = (props: Props) => {
  return (
    <SignupScreen
      banners={[]}
      buttons={[
        {
          label: 'Start account reset',
          onClick: () => props.onContinue(true),
          type: 'Default' as ButtonType,
        },
      ]}
      onBack={() => props.onContinue(false)}
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="medium">
        <Kb.Icon type="iconfont-skull" sizeType="Bigger" />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body">If you have lost all of your devices, or if you uninstalled</Kb.Text>
          <Kb.Text type="Body">Keybase from all of them, you can reset your account.</Kb.Text>
          <Kb.Text type="Body">You will keep your username but lose all your data.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

export default PromptReset
