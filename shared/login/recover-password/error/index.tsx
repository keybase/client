import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {SignupScreen} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

type Props = {
  error: string
  onBack: () => void
}

const Error = (props: Props) => (
  <SignupScreen
    banners={[]}
    buttons={[
      {
        label: 'Back',
        onClick: props.onBack,
        type: 'Default' as ButtonType,
      },
    ]}
    onBack={props.onBack}
    title="Recover password"
  >
    <Kb.Text center={true} type="Header" style={{maxWidth: 460, width: '80%'}}>
      Password recovery failed
    </Kb.Text>
    <Kb.Text type="Body" center={true}>
      {props.error}
    </Kb.Text>
  </SignupScreen>
)

export default Error
