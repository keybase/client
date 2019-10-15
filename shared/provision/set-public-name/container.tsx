import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import * as Container from '../../util/container'

const mapStateToProps = (state: Container.TypedState) => ({
  error: state.provision.error.stringValue(),
  waiting: Container.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => ({
  error: stateProps.error,
  onBack: dispatchProps.onBack,
  onSubmit: dispatchProps.onSubmit,
  waiting: stateProps.waiting,
}))(Container.safeSubmit(['onSubmit', 'onBack'], ['error'])(SetPublicName))
