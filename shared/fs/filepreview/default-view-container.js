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

const mapStateToProps = (state, {path}: OwnProps) => {
  const pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  const _username = state.config.username || undefined
  return {
    _path: path,
    _username,
    fileUIEnabled: state.fs.fuseStatus ? state.fs.fuseStatus.kextStarted : false,
    pathItem,
  }
}

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  download: () => dispatch(FsGen.createDownload(Constants.makeDownloadPayload(path))),
  saveMedia: () => dispatch(FsGen.createSaveMedia(Constants.makeDownloadPayload(path))),
  shareNative: () => dispatch(FsGen.createShareNative(Constants.makeDownloadPayload(path))),
  showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const {fileUIEnabled, _path, pathItem, _username} = stateProps
  const {download, saveMedia, shareNative, showInSystemFileManager} = dispatchProps
  const itemStyles = Constants.getItemStyles(Types.getPathElements(_path), pathItem.type, _username)
  return {
    download,
    fileUIEnabled,
    itemStyles,
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
