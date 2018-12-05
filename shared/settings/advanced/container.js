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
import {connect, lifecycle} from '../../util/container'

type OwnProps = {||}
const mapStateToProps = state => ({
  lockdownModeEnabled: state.settings.lockdownModeEnabled,
  openAtLogin: state.config.openAtLogin,
  processorProfileInProgress: Constants.processorProfileInProgress(state),
  traceInProgress: Constants.traceInProgress(state),
})

const mapDispatchToProps = dispatch => ({
  _loadLockdownMode: () => dispatch(createLoadLockdownMode()),
  onBack: () => dispatch(navigateUp()),
  onChangeLockdownMode: (checked: boolean) => dispatch(createOnChangeLockdownMode({enabled: checked})),
  onDBNuke: () => dispatch(navigateAppend(['dbNukeConfirm'])),
  onProcessorProfile: (durationSeconds: number) => dispatch(createProcessorProfile({durationSeconds})),
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
  onTrace: (durationSeconds: number) => dispatch(createTrace({durationSeconds})),
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
    },
  }),
  HeaderHoc
)(Advanced)
