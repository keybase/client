import * as Container from '../../util/container'
import ConfirmDisableCertPinningModal from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {createCertificatePinningToggled} from '../../actions/settings-gen'

export default Container.connect(
  () => ({}),
  dispatch => ({
    onCancel: () => {
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onConfirm: () => {
      dispatch(createCertificatePinningToggled({toggled: true}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps) => ({
    ...stateProps,
    ...dispatchProps,
  })
)(ConfirmDisableCertPinningModal)
