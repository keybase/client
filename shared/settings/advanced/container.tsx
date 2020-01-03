import * as ConfigGen from '../../actions/config-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as FSGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/settings'
import {anyErrors, anyWaiting} from '../../constants/waiting'
import Advanced from '.'
import * as Container from '../../util/container'
import {isLinux} from '../../constants/platform'

type OwnProps = {}

export default Container.connect(
  state => {
    const settingLockdownMode = anyWaiting(state, Constants.setLockdownModeWaitingKey)
    const setLockdownModeError = anyErrors(state, Constants.setLockdownModeWaitingKey)
    return {
      allowTlsMitmToggle: !!state.settings.didToggleCertificatePinning,
      hasRandomPW: !!state.settings.password.randomPW,
      lockdownModeEnabled: !!state.settings.lockdownModeEnabled,
      openAtLogin: state.config.openAtLogin,
      processorProfileInProgress: Constants.processorProfileInProgress(state),
      rememberPassword: state.settings.password.rememberPassword,
      setLockdownModeError: (setLockdownModeError && setLockdownModeError.message) || '',
      settingLockdownMode,
      traceInProgress: Constants.traceInProgress(state),
      useNativeFrame: state.config.useNativeFrame,
    }
  },
  dispatch => ({
    _loadHasRandomPW: () => dispatch(SettingsGen.createLoadHasRandomPw()),
    _loadLockdownMode: () => dispatch(SettingsGen.createLoadLockdownMode()),
    _loadNixOnLoginStartup: () => isLinux && dispatch(ConfigGen.createLoadNixOnLoginStartup()),
    _loadRememberPassword: () => dispatch(SettingsGen.createLoadRememberPassword()),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onChangeLockdownMode: (enabled: boolean) => dispatch(SettingsGen.createOnChangeLockdownMode({enabled})),
    onChangeRememberPassword: (remember: boolean) =>
      dispatch(SettingsGen.createOnChangeRememberPassword({remember})),
    onChangeUseNativeFrame: (useNativeFrame: boolean) =>
      dispatch(ConfigGen.createSetUseNativeFrame({useNativeFrame})),
    onDBNuke: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['dbNukeConfirm']})),
    onDisableCertPinning: () =>
      dispatch(RouteTreeGen.createNavigateAppend({path: ['disableCertPinningModal']})),
    onEnableCertPinning: () => dispatch(SettingsGen.createCertificatePinningToggled({toggled: false})),
    onExtraKBFSLogging: () => dispatch(FSGen.createSetDebugLevel({level: 'vlog2'})),
    onProcessorProfile: (durationSeconds: number) =>
      dispatch(SettingsGen.createProcessorProfile({durationSeconds})),
    onSetOpenAtLogin: (openAtLogin: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({openAtLogin})),
    onToggleRuntimeStats: () => dispatch(ConfigGen.createToggleRuntimeStats()),
    onTrace: (durationSeconds: number) => dispatch(SettingsGen.createTrace({durationSeconds})),
  }),
  (s, d, o: OwnProps) => {
    const {_loadHasRandomPW, _loadLockdownMode, _loadNixOnLoginStartup, _loadRememberPassword, ...restD} = d

    return {
      ...o,
      ...s,
      ...restD,
      load: () => {
        _loadLockdownMode()
        _loadHasRandomPW()
        _loadRememberPassword()
        _loadNixOnLoginStartup()
      },
    }
  }
)(HeaderHoc(Advanced))
