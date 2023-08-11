import * as Constants from '../../../constants/profile'
import * as C from '../../../constants'
import Success from '.'

export default () => {
  const errorText = Constants.useState(s =>
    s.errorCode !== undefined ? s.errorText || 'Failed to verify proof' : ''
  )
  const proofUsername = Constants.useState(s => s.username + s.platformGenericParams?.suffix ?? '@unknown')
  const serviceIcon = Constants.useState(s => s.platformGenericParams?.logoFull ?? [])
  const backToProfile = Constants.useState(s => s.dispatch.backToProfile)
  const clearPlatformGeneric = Constants.useState(s => s.dispatch.clearPlatformGeneric)
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
