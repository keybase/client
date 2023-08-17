import * as C from '../../constants'
import {ProxySettings as ProxySettingsComponent, ProxySettingsPopup} from '.'

const useConnect = () => {
  const allowTlsMitmToggle = C.useSettingsState(s => s.didToggleCertificatePinning)
  const setDidToggleCertificatePinning = C.useSettingsState(s => s.dispatch.setDidToggleCertificatePinning)
  const proxyData = C.useSettingsState(s => s.proxyData)
  const saveProxyData = C.useSettingsState(s => s.dispatch.setProxyData)
  const loadProxyData = C.useSettingsState(s => s.dispatch.loadProxyData)
  const resetCertPinningToggle = () => {
    setDidToggleCertificatePinning()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onBack = () => {
    navigateAppend('login')
  }
  const onDisableCertPinning = () => {
    navigateAppend('disableCertPinningModal')
  }
  const onEnableCertPinning = () => {
    setDidToggleCertificatePinning(false)
  }
  const props = {
    allowTlsMitmToggle,
    loadProxyData,
    onBack,
    onDisableCertPinning,
    onEnableCertPinning,
    proxyData,
    resetCertPinningToggle,
    saveProxyData,
  }

  return props
}

// Export the popup as the default export so it is easy to make a route pointing to it
export default () => {
  const props = useConnect()
  return <ProxySettingsPopup {...props} />
}

// The proxy settings component used in the advanced settings screen
const ProxySettings = () => {
  const props = useConnect()
  return <ProxySettingsComponent {...props} />
}
export {ProxySettings}
