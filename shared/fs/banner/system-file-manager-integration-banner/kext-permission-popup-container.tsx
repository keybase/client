import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import KextPermissionPopup from './kext-permission-popup'

const KPPContainer = () => {
  const driverStatus = Constants.useState(s => s.sfmi.driverStatus)
  const dispatch = Container.useDispatch()
  const onCancel = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const openSecurityPrefs = React.useCallback(
    () => dispatch(FsGen.createOpenSecurityPreferences()),
    [dispatch]
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
