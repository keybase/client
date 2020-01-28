import * as ConfigGen from '../../actions/config-gen'
import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as FSGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import Advanced from '.'
import {HeaderHoc} from '../../common-adapters'
import {anyErrors, anyWaiting} from '../../constants/waiting'

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
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(HeaderHoc(Advanced))
