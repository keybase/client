import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import VerifyPhoneNumber from './verify'

const mapStateToProps = (state: Container.TypedState) => ({
  error: '',
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()), // TODO: do we need to clear some data?
})

const ConnectedVerifyPhoneNumber = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: {}) => ({...o, ...s, ...d}),
  'ConnectedVerifyPhoneNumber'
)(VerifyPhoneNumber)

export default ConnectedVerifyPhoneNumber
