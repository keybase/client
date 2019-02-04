// @flow
import * as ConfigGen from '../../actions/config-gen'
import {
  createTrace,
  createProcessorProfile,
  createLoadLockdownMode,
  createLoadHasRandomPw,
  createOnChangeLockdownMode,
} from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import * as Constants from '../../constants/settings'
import {compose} from 'recompose'
import Advanced from './index'
import {connect, lifecycle} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  hasRandomPW: !!state.settings.passphrase.randomPW,
  lockdownModeEnabled: state.settings.lockdownModeEnabled,
  openAtLogin: state.config.openAtLogin,
  processorProfileInProgress: Constants.processorProfileInProgress(state),
  touchIDAllowedBySystem: state.config.touchIDAllowedBySystem,
  touchIDEnabled: state.config.touchIDEnabled,
  traceInProgress: Constants.traceInProgress(state),
})

const mapDispatchToProps = dispatch => ({
  _loadHasRandomPW: () => dispatch(createLoadHasRandomPw()),
  _loadLockdownMode: () => dispatch(createLoadLockdownMode()),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeLockdownMode: (checked: boolean) => dispatch(createOnChangeLockdownMode({enabled: checked})),
  onDBNuke: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['dbNukeConfirm']})),
  onProcessorProfile: (durationSeconds: number) => dispatch(createProcessorProfile({durationSeconds})),
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
  onTrace: (durationSeconds: number) => dispatch(createTrace({durationSeconds})),
  onSetTouchIDEnabled: (enabled: boolean) =>
    dispatch(ConfigGen.createTouchIDEnabled({enabled, writeToConfig: true})),
})

export default compose(
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
