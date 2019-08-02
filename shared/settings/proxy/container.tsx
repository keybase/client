import {
  createLoadProxyData,
  createSaveProxyData,
  createCertificatePinningToggled,
} from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import {connect, TypedState} from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {ProxySettings as ProxySettingsComponent, ProxySettingsPopup} from './index'

const mapStateToProps = (state: TypedState) => {
  return {
    allowTlsMitmToggle: state.settings.didToggleCertificatePinning,
    proxyData: state.settings.proxyData,
  }
}

const mapDispatchToProps = dispatch => ({
  _loadProxyData: () => dispatch(createLoadProxyData()),
  _resetCertPinningToggle: () => dispatch(createCertificatePinningToggled({toggled: null})),
  onBack: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['login']})),
  onDisableCertPinning: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']})),
  onEnableCertPinning: () => dispatch(createCertificatePinningToggled({toggled: false})),
  saveProxyData: (proxyData: RPCTypes.ProxyData) => dispatch(createSaveProxyData({proxyData})),
})

const mergeProps = (stateProps, dispatchProps, _) => {
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
export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(HeaderHoc(ProxySettingsPopup))

// The proxy settings component used in the advanced settings screen
const ProxySettings = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ProxySettingsComponent)
export {ProxySettings}
