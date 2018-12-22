// @flow
import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
  onLoadingStateChange?: () => void,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  fileUIEnabled: state.fs.fuseStatus ? state.fs.fuseStatus.kextStarted : false,
  pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  download: () => dispatch(FsGen.createDownload(Constants.makeDownloadPayload(path))),
  saveMedia: () => dispatch(FsGen.createSaveMedia(Constants.makeDownloadPayload(path))),
  shareNative: () => dispatch(FsGen.createShareNative(Constants.makeDownloadPayload(path))),
  showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const mergeProps = (stateProps, dispatchProps, {path}) => {
  const {fileUIEnabled, pathItem} = stateProps
  const {download, saveMedia, shareNative, showInSystemFileManager} = dispatchProps
  return {
    download,
    fileUIEnabled,
    path,
    pathItem,
    saveMedia,
    shareNative,
    showInSystemFileManager,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'FilePreviewDefaultView'
)(DefaultView)
