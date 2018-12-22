// @flow
import * as WaitingConstants from '../../constants/waiting'
import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import PaperKey from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {||}

const mapStateToProps = state => ({
  paperkey: state.devices.newPaperkey.stringValue(),
  waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  paperkey: stateProps.paperkey,
  waiting: stateProps.waiting,
})

export default Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(PaperKey)
