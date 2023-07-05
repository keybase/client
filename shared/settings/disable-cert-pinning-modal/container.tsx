import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import ConfirmDisableCertPinningModal from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

export default () => {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const setDidToggleCertificatePinning = Constants.useState(s => s.dispatch.setDidToggleCertificatePinning)
  const onConfirm = () => {
    setDidToggleCertificatePinning(true)
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    onCancel,
    onConfirm,
  }
  return <ConfirmDisableCertPinningModal {...props} />
}
