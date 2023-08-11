import * as React from 'react'
import * as C from '../../../constants'
import * as Constants from '../../../constants/fs'
import KextPermissionPopup from './kext-permission-popup'

const KPPContainer = () => {
  const driverStatus = Constants.useState(s => s.sfmi.driverStatus)
  const openSecurityPreferencesDesktop = Constants.useState(
    s => s.dispatch.dynamic.openSecurityPreferencesDesktop
  )
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
