import * as C from '../../../constants'
import Success from '.'

export default () => {
  const errorText = C.useProfileState(s =>
    s.errorCode !== undefined ? s.errorText || 'Failed to verify proof' : ''
  )
  const proofUsername = C.useProfileState(s => s.username + s.platformGenericParams?.suffix ?? '@unknown')
  const serviceIcon = C.useProfileState(s => s.platformGenericParams?.logoFull ?? [])
  const backToProfile = C.useProfileState(s => s.dispatch.backToProfile)
  const clearPlatformGeneric = C.useProfileState(s => s.dispatch.clearPlatformGeneric)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
    backToProfile()
    clearPlatformGeneric()
  }
  const props = {
    errorText,
    onClose,
    proofUsername,
    serviceIcon,
  }
  return <Success {...props} />
}
