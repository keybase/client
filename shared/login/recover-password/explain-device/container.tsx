import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import ExplainDevice from '.'

const ConnectedExplainDevice = () => {
  const ed = Container.useSelector(state => state.recoverPassword.explainedDevice)
  const deviceName = ed ? ed.name : ''
  const deviceType = ed ? ed.type : undefined
  const username = Container.useSelector(state => state.recoverPassword.username)
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RecoverPasswordGen.createRestartRecovery())
  }
  const onComplete = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    deviceName,
    deviceType,
    onBack,
    onComplete,
    username,
  }
  return <ExplainDevice {...props} />
}

export default ConnectedExplainDevice
