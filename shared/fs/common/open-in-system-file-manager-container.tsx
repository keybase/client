import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'
import OpenInSystemFileManager from './open-in-system-file-manager'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = state => ({
  driverEnabled: state.fs.sfmi.driverStatus.type === Types.DriverStatusType.Enabled,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  enableDriver: () => dispatch(FsGen.createDriverEnable({})),
  openInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const connected = namedConnect(
  mapStateToProps,
  mapDispatchToProps,
    (s, d, _: OwnProps) => ({...s, ...d}),
  'ConnectedOpenInSystemFileManager'
)(OpenInSystemFileManager)

export default (isMobile ? () => null : connected)
