import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import type {ButtonType} from '../../common-adapters/button'
import {SignupScreen} from '../../signup/common'

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
const ConnectedError = () => {
  const props = useConn()
  return <Error {...props} />
}

export default ConnectedError

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
