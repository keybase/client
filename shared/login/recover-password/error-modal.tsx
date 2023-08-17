import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'

type Props = {
  error: string
  onBack: () => void
}

const useConn = () => {
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const error = C.useRecoverState(s => s.error)
  const popStack = C.useRouterState(s => s.dispatch.popStack)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
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
