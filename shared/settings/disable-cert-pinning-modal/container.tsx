import * as Container from '../../util/container'
import ConfirmDisableCertPinningModal from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {createCertificatePinningToggled} from '../../actions/settings-gen'

export default () => {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onConfirm = () => {
    dispatch(createCertificatePinningToggled({toggled: true}))
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    onCancel,
    onConfirm,
  }
  return <ConfirmDisableCertPinningModal {...props} />
}
