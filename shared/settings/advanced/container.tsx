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
import * as Constants from '../../constants/settings'
import {anyErrors, anyWaiting} from '../../constants/waiting'
import {compose} from 'recompose'
import Advanced from './index'
import {connect, lifecycle, TypedState} from '../../util/container'
import * as RPCTypes from '../../constants/types/rpc-gen'

type OwnProps = {}
const mapStateToProps = (state: TypedState) => {
  const settingLockdownMode = anyWaiting(state, Constants.setLockdownModeWaitingKey)
  const setLockdownModeError = anyErrors(state, Constants.setLockdownModeWaitingKey)
  return {
    allowTlsMitmToggle: state.settings.didToggleCertificatePinning,
    hasRandomPW: !!state.settings.password.randomPW,
    lockdownModeEnabled: state.settings.lockdownModeEnabled,
    openAtLogin: state.config.openAtLogin,
    processorProfileInProgress: Constants.processorProfileInProgress(state),
    proxyData: state.settings.proxyData,
    rememberPassword: state.settings.password.rememberPassword,
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
  _loadRememberPassword: () => dispatch(createLoadRememberPassword()),
  _resetCertPinningToggle: () => dispatch(createCertificatePinningToggled({toggled: null})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeLockdownMode: (checked: boolean) => dispatch(createOnChangeLockdownMode({enabled: checked})),
  onChangeRememberPassword: (checked: boolean) =>
    dispatch(createOnChangeRememberPassword({remember: checked})),
  onChangeUseNativeFrame: (checked: boolean) => dispatch(createOnChangeUseNativeFrame({enabled: checked})),
  onDBNuke: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['dbNukeConfirm']})),
  onDisableCertPinning: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']})),
  onEnableCertPinning: () => dispatch(createCertificatePinningToggled({toggled: false})),
  onExtraKBFSLogging: () => dispatch(FSGen.createSetDebugLevel({level: 'vlog1'})),
  onProcessorProfile: (durationSeconds: number) => dispatch(createProcessorProfile({durationSeconds})),
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
  onToggleRuntimeStats: () => dispatch(createToggleRuntimeStats()),
  onTrace: (durationSeconds: number) => dispatch(createTrace({durationSeconds})),
  saveProxyData: (proxyData: RPCTypes.ProxyData) => dispatch(createSaveProxyData({proxyData})),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
      (s, d, o: OwnProps) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadLockdownMode()
      this.props._loadHasRandomPW()
      this.props._loadProxyData()
      this.props._loadRememberPassword()
    },
    componentWillUnmount() {
      this.props._resetCertPinningToggle()
    },
  } as any),
  HeaderHoc
  // @ts-ignore
)(Advanced)
