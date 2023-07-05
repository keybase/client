import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import type * as RPCTypes from '../../constants/types/rpc-gen'
import {ProxySettings as ProxySettingsComponent, ProxySettingsPopup} from '.'

const useConnect = () => {
  const allowTlsMitmToggle = Constants.useState(s => s.didToggleCertificatePinning)
  const setDidToggleCertificatePinning = Constants.useState(s => s.dispatch.setDidToggleCertificatePinning)
  const proxyData = Container.useSelector(state => state.settings.proxyData)

  const dispatch = Container.useDispatch()
  const loadProxyData = () => {
    dispatch(SettingsGen.createLoadProxyData())
  }
  const resetCertPinningToggle = () => {
    setDidToggleCertificatePinning()
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['login']}))
  }
  const onDisableCertPinning = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']}))
  }
  const onEnableCertPinning = () => {
    setDidToggleCertificatePinning(false)
  }
  const saveProxyData = (proxyData: RPCTypes.ProxyData) => {
    dispatch(SettingsGen.createSaveProxyData({proxyData}))
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
