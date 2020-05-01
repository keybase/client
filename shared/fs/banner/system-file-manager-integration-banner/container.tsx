import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'

type OwnProps = {
  alwaysShow?: boolean | null
}

const mapStateToProps = state => ({
  driverStatus: state.fs.sfmi.driverStatus,
  settings: state.fs.settings,
})

const mapDispatchToProps = dispatch => ({
  onDisable: () => dispatch(FsGen.createDriverDisable()),
  onDismiss: () => dispatch(FsGen.createSetSfmiBannerDismissed({dismissed: true})),
  onEnable: () => dispatch(FsGen.createDriverEnable({})),
})

const ConnectedBanner = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'SystemFileManagerIntegrationBanner'
)(Banner)

export default ConnectedBanner
