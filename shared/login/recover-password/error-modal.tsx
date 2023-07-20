import * as ConfigConstants from '../../constants/config'
import * as Constants from '../../constants/recover-password'
import * as RouterConstants from '../../constants/router2'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'

type Props = {
  error: string
  onBack: () => void
}

const useConn = () => {
  const loggedIn = ConfigConstants.useConfigState(s => s.loggedIn)
  const error = Constants.useState(s => s.error)
  const popStack = RouterConstants.useState(s => s.dispatch.popStack)
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    loggedIn ? navigateUp() : popStack()
  }
  return {error, onBack}
}

const ErrorModal = (props: Props) => (
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

const styles = Styles.styleSheetCreate(() => ({
  padding: {
    padding: Styles.globalMargins.small,
  },
}))

const ConnectedErrorModal = () => {
  const props = useConn()
  return <ErrorModal {...props} />
}
export default ConnectedErrorModal
