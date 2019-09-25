import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Error from '.'

type OwnProps = {}

const ConnectedError = Container.connect(
  state => ({
    error: state.recoverPassword.paperKeyError.stringValue(),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(Error)

export default ConnectedError
