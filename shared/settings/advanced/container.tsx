import * as ConfigGen from '../../actions/config-gen'
import {
  createTrace,
  createProcessorProfile,
  createLoadLockdownMode,
  createLoadHasRandomPw,
  createOnChangeLockdownMode,
  createOnChangeUseNativeFrame,
} from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/settings'
import {anyErrors, anyWaiting} from '../../constants/waiting'
import {compose} from 'recompose'
import Advanced from './index'
import {connect, lifecycle} from '../../util/container'

type OwnProps = {}
const mapStateToProps = state => {
  const settingLockdownMode = anyWaiting(state, Constants.setLockdownModeWaitingKey)
  const setLockdownModeError = anyErrors(state, Constants.setLockdownModeWaitingKey)
  return {
    hasRandomPW: !!state.settings.password.randomPW,
    lockdownModeEnabled: state.settings.lockdownModeEnabled,
    openAtLogin: state.config.openAtLogin,
    processorProfileInProgress: Constants.processorProfileInProgress(state),
    // Auto generated from flowToTs. Please clean me!
    setLockdownModeError:
      // Auto generated from flowToTs. Please clean me!
      (setLockdownModeError === null || setLockdownModeError === undefined
        ? undefined
        : setLockdownModeError.message) !== null && // Auto generated from flowToTs. Please clean me!
      (setLockdownModeError === null || setLockdownModeError === undefined
        ? undefined
        : setLockdownModeError.message) !== undefined // Auto generated from flowToTs. Please clean me!
        ? setLockdownModeError === null || setLockdownModeError === undefined
          ? undefined
          : setLockdownModeError.message
        : '',
    settingLockdownMode,
    traceInProgress: Constants.traceInProgress(state),
    useNativeFrame: state.settings.useNativeFrame,
  }
}

const mapDispatchToProps = dispatch => ({
  _loadHasRandomPW: () => dispatch(createLoadHasRandomPw()),
  _loadLockdownMode: () => dispatch(createLoadLockdownMode()),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeLockdownMode: (checked: boolean) => dispatch(createOnChangeLockdownMode({enabled: checked})),
  onChangeUseNativeFrame: (checked: boolean) => dispatch(createOnChangeUseNativeFrame({enabled: checked})),
  onDBNuke: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['dbNukeConfirm']})),
  onProcessorProfile: (durationSeconds: number) => dispatch(createProcessorProfile({durationSeconds})),
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
  onTrace: (durationSeconds: number) => dispatch(createTrace({durationSeconds})),
})

export default compose(
  // @ts-ignore codemod-issue
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props._loadLockdownMode()
      this.props._loadHasRandomPW()
    },
  }),
  HeaderHoc
)(Advanced)
