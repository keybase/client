import * as Kb from '../../common-adapters'
import {connect} from '../../util/container'
import ConfirmDisableCertPinningModal from '.'
import * as RouteTreeGen from "../../actions/route-tree-gen";
import {createSetCertificatePinning, createCertificatePinningToggled} from "../../actions/settings-gen";

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(createCertificatePinningToggled({toggled: false}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onConfirm: () => {
    dispatch(createSetCertificatePinning({enabled: false}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Kb.HeaderOrPopup(ConfirmDisableCertPinningModal))
