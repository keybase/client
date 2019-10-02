import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Error, {ErrorModal} from '.'

type OwnProps = {}

const connector = Container.connect(
  state => ({
    _loggedIn: state.config.loggedIn,
    error: state.recoverPassword.error.stringValue(),
  }),
  dispatch => ({
    onBack: (loggedIn: boolean) =>
      loggedIn
        ? dispatch(RouteTreeGen.createNavigateUp())
        : dispatch(
            RouteTreeGen.createResetStack({
              actions: [RouteTreeGen.createNavigateAppend({path: ['login']})],
              index: 0,
              tab: 'loggedOut',
            })
          ),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: stateProps.error,
    onBack: () => dispatchProps.onBack(stateProps._loggedIn),
  })
)
const ConnectedError = connector(Error)
export const ConnectedErrorModal = connector(ErrorModal)

export default ConnectedError
