import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import PaperKey from '.'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _configuredAccounts: state.config.configuredAccounts,
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDevice.name || ''}...`,
  waiting: Container.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (paperKey: string) =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperKey)})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: stateProps.error,
    hint: stateProps.hint,
    onBack: dispatchProps.onBack,
    onSubmit: dispatchProps.onSubmit,
    waiting: stateProps.waiting,
  })
)(PaperKey)
