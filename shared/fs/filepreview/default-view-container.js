// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  const _username = state.config.username || undefined
  return {
    _username,
    _path: path,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
    pathItem,
  }
}

const mapDispatchToProps = (dispatch, {path, routePath}) => ({
  download: () => dispatch(FsGen.createDownload({path, intent: 'none'})),
  saveMedia: () => dispatch(FsGen.createSaveMedia({path, routePath})),
  shareNative: () => dispatch(FsGen.createShareNative({path, routePath})),
  showInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const {fileUIEnabled, _path, pathItem, _username} = stateProps
  const {download, saveMedia, shareNative, showInFileUI} = dispatchProps
  const itemStyles = Constants.getItemStyles(Types.getPathElements(_path), pathItem.type, _username)
  return {
    fileUIEnabled,
    itemStyles,
    pathItem,
    download,
    save: saveMedia,
    share: shareNative,
    showInFileUI,
  }
}

export default compose(
  // $FlowIssue @jzils new flow errors here
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilePreviewDefaultView')
)(DefaultView)
