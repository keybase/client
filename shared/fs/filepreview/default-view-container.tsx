import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  pathItem: Constants.getPathItem(state.fs.pathItems, path),
  sfmiEnabled: state.fs.sfmi.driverStatus === Types.DriverStatusType.Enabled,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  download: () => dispatch(FsGen.createDownload({path})),
  showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => {
  const {sfmiEnabled, pathItem} = stateProps
  const {download, showInSystemFileManager} = dispatchProps
  return {
    download,
    path,
    pathItem,
    sfmiEnabled,
    showInSystemFileManager,
  }
}

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'FilePreviewDefaultView'
)(DefaultView)
