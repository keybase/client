import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Error, {ErrorModal} from '.'

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
export const ConnectedErrorModal = () => {
  const props = useConn()
  return <ErrorModal {...props} />
}

export default ConnectedError
