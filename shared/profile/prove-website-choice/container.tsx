import * as RouterConstants from '../../constants/router2'
import ProveWebsiteChoice from '.'
import * as Constants from '../../constants/profile'

export default () => {
  const cancelAddProof = Constants.useState(s => s.dispatch.dynamic.cancelAddProof)
  const addProof = Constants.useState(s => s.dispatch.addProof)
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onCancel = () => {
    cancelAddProof?.()
    clearModals()
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
