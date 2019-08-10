import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {SignupScreen} from '../../../signup/common'

export type Props = {
  deviceName: string
  deviceType: string
  onBack: () => void
  onComplete: () => void
}

const ExplainDevice = (props: Props) => {
  return (
    <SignupScreen banners={[]} buttons={[]} onBack={props.onBack} title="Recover password">
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} fullHeight={true}>
        <Kb.Text type="Body">
          On {props.deviceName} go to Settings > Your account, and change your password.
        </Kb.Text>
      </Kb.Box2>
    </SignupScreen>
  )
}

export default ExplainDevice
