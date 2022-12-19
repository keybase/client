import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import type * as RPCTypes from '../../constants/types/rpc-gen'
import {ProxySettings as ProxySettingsComponent, ProxySettingsPopup} from '.'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => {
  return {
    allowTlsMitmToggle: state.settings.didToggleCertificatePinning,
    proxyData: state.settings.proxyData,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _loadProxyData: () => dispatch(SettingsGen.createLoadProxyData()),
  _resetCertPinningToggle: () => dispatch(SettingsGen.createCertificatePinningToggled({})),
  onBack: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['login']})),
  onDisableCertPinning: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']})),
  onEnableCertPinning: () => dispatch(SettingsGen.createCertificatePinningToggled({toggled: false})),
  saveProxyData: (proxyData: RPCTypes.ProxyData) => dispatch(SettingsGen.createSaveProxyData({proxyData})),
})

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  _: OwnProps
) => {
  return {
    _loadProxyData: dispatchProps._loadProxyData,
    _resetCertPinningToggle: dispatchProps._resetCertPinningToggle,
    allowTlsMitmToggle: stateProps.allowTlsMitmToggle,
    onBack: dispatchProps.onBack,
    onDisableCertPinning: dispatchProps.onDisableCertPinning,
    onEnableCertPinning: dispatchProps.onEnableCertPinning,
    proxyData: stateProps.proxyData,
    saveProxyData: dispatchProps.saveProxyData,
  }
}

// Export the popup as the default export so it is easy to make a route pointing to it
export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(ProxySettingsPopup)

// The proxy settings component used in the advanced settings screen
const ProxySettings = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ProxySettingsComponent)
export {ProxySettings}
