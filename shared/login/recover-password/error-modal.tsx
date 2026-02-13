import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useState as useRecoverState} from '@/stores/recover-password'
import {useConfigState} from '@/stores/config'

const styles = Kb.Styles.styleSheetCreate(() => ({
  padding: {
    padding: Kb.Styles.globalMargins.small,
  },
}))

const ConnectedErrorModal = () => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const error = useRecoverState(s => s.error)
  const popStack = C.useRouterState(s => s.dispatch.popStack)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    loggedIn ? navigateUp() : popStack()
  }

  return (
    <Kb.Modal
      header={{title: 'Error'}}
      footer={{content: <Kb.Button label="Back" onClick={onBack} fullWidth={true} />}}
      onClose={onBack}
    >
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.padding}>
        <Kb.Text type="Body" center={true}>
          {error}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}
export default ConnectedErrorModal
