import * as C from '../../constants'
import ProveWebsiteChoice from '.'

export default () => {
  const cancelAddProof = C.useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const addProof = C.useProfileState(s => s.dispatch.addProof)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
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
