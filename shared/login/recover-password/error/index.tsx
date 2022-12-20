import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import type {ButtonType} from '../../../common-adapters/button'

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

export const ErrorModal = (props: Props) => (
  <Kb.Modal
    header={{title: 'Error'}}
    footer={{content: <Kb.Button label="Back" onClick={props.onBack} fullWidth={true} />}}
    onClose={props.onBack}
  >
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.padding}>
      <Kb.Text type="Body" center={true}>
        {props.error}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Modal>
)

Error.navigationOptions = {
  gesturesEnabled: false,
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
ErrorModal.navigationOptions = {
  gesturesEnabled: false,
}

const styles = Styles.styleSheetCreate(() => ({
  padding: {
    padding: Styles.globalMargins.small,
  },
}))

export default Error
