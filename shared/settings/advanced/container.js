// @flow
import * as ConfigGen from '../../actions/config-gen'
import {
  createTrace,
  createProcessorProfile,
  createLoadLockdownMode,
  createOnChangeLockdownMode,
} from '../../actions/settings-gen'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/settings'
import {compose} from 'recompose'
import Advanced from './index'
import {connect, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  lockdownModeEnabled: state.settings.lockdownModeEnabled,
  openAtLogin: state.config.openAtLogin,
  processorProfileInProgress: Constants.processorProfileInProgress(state),
  touchIDAllowedBySystem: state.config.touchIDAllowedBySystem,
  touchIDEnabled: state.config.touchIDEnabled,
  traceInProgress: Constants.traceInProgress(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadLockdownMode: () => dispatch(createLoadLockdownMode()),
  onBack: () => dispatch(navigateUp()),
  onChangeLockdownMode: (checked: boolean) => dispatch(createOnChangeLockdownMode({enabled: checked})),
  onDBNuke: () => dispatch(navigateAppend(['dbNukeConfirm'])),
  onProcessorProfile: (durationSeconds: number) => dispatch(createProcessorProfile({durationSeconds})),
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
  onTrace: (durationSeconds: number) => dispatch(createTrace({durationSeconds})),
  onSetTouchIDEnabled: (enabled: boolean) =>
    dispatch(ConfigGen.createTouchIDEnabled({enabled, writeToConfig: true})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  lifecycle({
    componentDidMount() {
      this.props._loadLockdownMode()
    },
  }),
  HeaderHoc
)(Advanced)
