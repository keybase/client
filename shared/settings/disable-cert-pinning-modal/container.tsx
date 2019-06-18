import * as Kb from '../../common-adapters'
import {connect} from '../../util/container'
import ConfirmDisableCertPinningModal from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {createCertificatePinningToggled} from '../../actions/settings-gen'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onConfirm: () => {
    dispatch(createCertificatePinningToggled({toggled: true}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ConfirmDisableCertPinningModal)
