import * as ConfigGen from '../../actions/config-gen'
import {
  createTrace,
  createProcessorProfile,
  createLoadLockdownMode,
  createLoadHasRandomPw,
  createOnChangeLockdownMode,
  createOnChangeUseNativeFrame,
  createLoadProxyData,
  createSaveProxyData,
  createCertificatePinningToggled,
} from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/settings'
import {anyErrors, anyWaiting} from '../../constants/waiting'
import {compose} from 'recompose'
import Advanced from './index'
import {connect, lifecycle} from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'

type OwnProps = {}
const mapStateToProps = state => {
  const settingLockdownMode = anyWaiting(state, Constants.setLockdownModeWaitingKey)
  const setLockdownModeError = anyErrors(state, Constants.setLockdownModeWaitingKey)
  return {
    allowTlsMitmToggle: state.settings.didToggleCertificatePinning,
    hasRandomPW: !!state.settings.password.randomPW,
    lockdownModeEnabled: state.settings.lockdownModeEnabled,
    openAtLogin: state.config.openAtLogin,
    processorProfileInProgress: Constants.processorProfileInProgress(state),
    proxyData: state.settings.proxyData,
    setLockdownModeError: (setLockdownModeError && setLockdownModeError.message) || '',
    settingLockdownMode,
    traceInProgress: Constants.traceInProgress(state),
    useNativeFrame: state.settings.useNativeFrame,
  }
}

const mapDispatchToProps = dispatch => ({
  _loadHasRandomPW: () => dispatch(createLoadHasRandomPw()),
  _loadLockdownMode: () => dispatch(createLoadLockdownMode()),
  _loadProxyData: () => dispatch(createLoadProxyData()),
  _resetCertPinningToggle: () => dispatch(createCertificatePinningToggled({toggled: null})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeLockdownMode: (checked: boolean) => dispatch(createOnChangeLockdownMode({enabled: checked})),
  onChangeUseNativeFrame: (checked: boolean) => dispatch(createOnChangeUseNativeFrame({enabled: checked})),
  onDBNuke: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['dbNukeConfirm']})),
  onDisableCertPinning: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']})),
  onEnableCertPinning: () => dispatch(createCertificatePinningToggled({toggled: false})),
  onProcessorProfile: (durationSeconds: number) => dispatch(createProcessorProfile({durationSeconds})),
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
  onTrace: (durationSeconds: number) => dispatch(createTrace({durationSeconds})),
  saveProxyData: (proxyData: RPCTypes.ProxyData) => dispatch(createSaveProxyData({proxyData})),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadLockdownMode()
      this.props._loadHasRandomPW()
      this.props._loadProxyData()
    },
    componentWillUnmount() {
      this.props._resetCertPinningToggle()
    },
  } as any),
  HeaderHoc
  // @ts-ignore
)(Advanced)
