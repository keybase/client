// @flow
import * as WaitingConstants from '../../constants/waiting'
import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import PaperKey from '.'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: Container.TypedState) => ({
  paperkey: state.devices.newPaperkey.stringValue(),
  waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  paperkey: stateProps.paperkey,
  waiting: stateProps.waiting,
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(PaperKey)
