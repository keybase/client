import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import PaperKey from '.'

type OwnProps = {}

export default Container.connect(
  state => ({
    _configuredAccounts: state.config.configuredAccounts,
    error: state.provision.error.stringValue(),
    hint: `${state.provision.codePageOtherDevice.name || ''}...`,
    waiting: Container.anyWaiting(state, Constants.waitingKey),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (paperkey: string) =>
      dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperkey)})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: stateProps.error,
    hint: stateProps.hint,
    onBack: dispatchProps.onBack,
    onSubmit: (paperkey: string) => !stateProps.waiting && dispatchProps.onSubmit(paperkey),
    waiting: stateProps.waiting,
  })
)(PaperKey)
