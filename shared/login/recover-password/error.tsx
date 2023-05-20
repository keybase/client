import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type {ButtonType} from '../../common-adapters/button'
import {SignupScreen} from '../../signup/common'

const useConn = () => {
  const loggedIn = Container.useSelector(state => state.config.loggedIn)
  const error = Container.useSelector(state => state.recoverPassword.error.stringValue())
  const dispatch = Container.useDispatch()
  const onBack = () => {
    loggedIn ? dispatch(RouteTreeGen.createNavigateUp()) : dispatch(RouteTreeGen.createPopStack())
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
