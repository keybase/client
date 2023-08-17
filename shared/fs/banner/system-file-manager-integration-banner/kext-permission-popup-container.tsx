import * as React from 'react'
import * as C from '../../../constants'
import KextPermissionPopup from './kext-permission-popup'

const KPPContainer = () => {
  const driverStatus = C.useFSState(s => s.sfmi.driverStatus)
  const openSecurityPreferencesDesktop = C.useFSState(s => s.dispatch.dynamic.openSecurityPreferencesDesktop)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = navigateUp
  const openSecurityPrefs = React.useCallback(
    () => openSecurityPreferencesDesktop?.(),
    [openSecurityPreferencesDesktop]
  )
  return (
    <KextPermissionPopup
      driverStatus={driverStatus}
      onCancel={onCancel}
      openSecurityPrefs={openSecurityPrefs}
    />
  )
}
export default KPPContainer
