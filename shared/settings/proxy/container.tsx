import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import type * as RPCTypes from '../../constants/types/rpc-gen'
import {ProxySettings as ProxySettingsComponent, ProxySettingsPopup} from '.'

const useConnect = () => {
  const allowTlsMitmToggle = Container.useSelector(state => state.settings.didToggleCertificatePinning)
  const proxyData = Container.useSelector(state => state.settings.proxyData)

  const dispatch = Container.useDispatch()
  const _loadProxyData = () => {
    dispatch(SettingsGen.createLoadProxyData())
  }
  const _resetCertPinningToggle = () => {
    dispatch(SettingsGen.createCertificatePinningToggled({}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['login']}))
  }
  const onDisableCertPinning = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']}))
  }
  const onEnableCertPinning = () => {
    dispatch(SettingsGen.createCertificatePinningToggled({toggled: false}))
  }
  const saveProxyData = (proxyData: RPCTypes.ProxyData) => {
    dispatch(SettingsGen.createSaveProxyData({proxyData}))
  }

  const props = {
    _loadProxyData: _loadProxyData,
    _resetCertPinningToggle: _resetCertPinningToggle,
    allowTlsMitmToggle: allowTlsMitmToggle,
    onBack: onBack,
    onDisableCertPinning: onDisableCertPinning,
    onEnableCertPinning: onEnableCertPinning,
    proxyData: proxyData,
    saveProxyData: saveProxyData,
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
