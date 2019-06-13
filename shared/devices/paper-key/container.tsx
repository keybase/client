import * as WaitingConstants from '../../constants/waiting'
import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import PaperKey from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {}

export default Container.connect(
  state => ({
    paperkey: state.devices.newPaperkey.stringValue(),
    waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createClearModals()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onBack: dispatchProps.onBack,
    paperkey: stateProps.paperkey,
    waiting: stateProps.waiting,
  })
)(PaperKey)
