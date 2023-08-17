import * as React from 'react'
import * as C from '../../../constants'
import Banner from './index'

type OwnProps = {
  alwaysShow?: boolean
}

const SFMIContainer = (op: OwnProps) => {
  const driverStatus = C.useFSState(s => s.sfmi.driverStatus)
  const driverEnable = C.useFSState(s => s.dispatch.driverEnable)
  const driverDisable = C.useFSState(s => s.dispatch.driverDisable)
  const setSfmiBannerDismissedDesktop = C.useFSState(s => s.dispatch.dynamic.setSfmiBannerDismissedDesktop)
  const settings = C.useFSState(s => s.settings)
  const onDisable = React.useCallback(() => driverDisable(), [driverDisable])
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
