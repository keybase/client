import * as React from 'react'
import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/fs'

type OwnProps = {
  alwaysShow?: boolean
}

const SFMIContainer = (op: OwnProps) => {
  const driverStatus = Constants.useState(s => s.sfmi.driverStatus)
  const driverEnable = Constants.useState(s => s.dispatch.driverEnable)
  const setSfmiBannerDismissedDesktop = Constants.useState(
    s => s.dispatch.dynamic.setSfmiBannerDismissedDesktop
  )
  const settings = Constants.useState(s => s.settings)
  const dispatch = Container.useDispatch()
  const onDisable = React.useCallback(() => dispatch(FsGen.createDriverDisable()), [dispatch])
  const onDismiss = React.useCallback(
    () => setSfmiBannerDismissedDesktop?.(true),
    [setSfmiBannerDismissedDesktop]
  )
  const onEnable = driverEnable
  return (
    <Banner
      alwaysShow={op.alwaysShow}
      driverStatus={driverStatus}
      settings={settings}
      onDisable={onDisable}
      onDismiss={onDismiss}
      onEnable={onEnable}
    />
  )
}
export default SFMIContainer
