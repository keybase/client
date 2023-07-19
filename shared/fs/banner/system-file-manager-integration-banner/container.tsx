import * as React from 'react'
import * as Constants from '../../../constants/fs'
import Banner from './index'

type OwnProps = {
  alwaysShow?: boolean
}

const SFMIContainer = (op: OwnProps) => {
  const driverStatus = Constants.useState(s => s.sfmi.driverStatus)
  const driverEnable = Constants.useState(s => s.dispatch.driverEnable)
  const driverDisable = Constants.useState(s => s.dispatch.driverDisable)
  const setSfmiBannerDismissedDesktop = Constants.useState(
    s => s.dispatch.dynamic.setSfmiBannerDismissedDesktop
  )
  const settings = Constants.useState(s => s.settings)
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
