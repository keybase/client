import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ProveWebsiteChoice from '.'
import * as Container from '../../util/container'

export default () => {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(ProfileGen.createCancelAddProof())
    dispatch(RouteTreeGen.createClearModals())
  }
  const onDNS = () => {
    dispatch(ProfileGen.createAddProof({platform: 'dns', reason: 'profile'}))
  }
  const onFile = () => {
    dispatch(ProfileGen.createAddProof({platform: 'web', reason: 'profile'}))
  }
  const props = {
    onCancel,
    onDNS,
    onFile,
  }
  return <ProveWebsiteChoice {...props} />
}
