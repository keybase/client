import * as RouteTreeGen from '../../actions/route-tree-gen'
import ProveWebsiteChoice from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'

export default () => {
  const dispatch = Container.useDispatch()
  const cancelAddProof = Constants.useState(s => s.dispatch.cancelAddProof)
  const addProof = Constants.useState(s => s.dispatch.addProof)
  const onCancel = () => {
    cancelAddProof()
    dispatch(RouteTreeGen.createClearModals())
  }
  const onDNS = () => {
    addProof('dns', 'profile')
  }
  const onFile = () => {
    addProof('web', 'profile')
  }
  const props = {
    onCancel,
    onDNS,
    onFile,
  }
  return <ProveWebsiteChoice {...props} />
}
