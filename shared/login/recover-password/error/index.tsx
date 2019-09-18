import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

type Props = {
  error: string
  onBack: () => void
}

const Error = (props: Props) => (
  <SignupScreen
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

Error.navigationOptions = {
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

export default Error
