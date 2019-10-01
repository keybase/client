import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Error, {ErrorModal} from '.'

type OwnProps = {}

const connector = Container.connect(
  state => ({
    error: state.recoverPassword.error.stringValue(),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)
const ConnectedError = connector(Error)
export const ConnectedErrorModal = connector(ErrorModal)

export default ConnectedError
