import * as ConfigGen from '../../actions/config-gen'
import {
  createTrace,
  createProcessorProfile,
  createLoadLockdownMode,
  createLoadHasRandomPw,
  createOnChangeLockdownMode,
  createOnChangeUseNativeFrame,
  createOnChangeRememberPassword,
  createLoadProxyData,
  createLoadRememberPassword,
  createSaveProxyData,
  createCertificatePinningToggled,
  createToggleRuntimeStats,
} from '../../actions/settings-gen'
import * as FSGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import {compose} from 'recompose'
import {connect, lifecycle, TypedState} from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {ProxySettings as ProxySettingsComponent, ProxySettingsPopup} from './index'

type OwnProps = {}

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

// Export the popup as the default export so it is easy to make a route pointing to it
export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadProxyData()
    },
    componentWillUnmount() {
      this.props._resetCertPinningToggle()
    },
  } as any),
  HeaderHoc
  // @ts-ignore
)(ProxySettingsPopup)

const ProxySettings = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadProxyData()
    },
    componentWillUnmount() {
      this.props._resetCertPinningToggle()
    },
  } as any),
  HeaderHoc
  // @ts-ignore
)(ProxySettingsComponent)

export {
  // The proxy settings component used in the advanced settings screen
  ProxySettings,
}
