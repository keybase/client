// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import Confirm from './confirm'
import type {FloatingMenuProps} from './types'

type OwnProps = {|
  action: Types.PathItemActionMenuConfirmActionType,
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
|}

const mapStateToProps = (state, {path}) => ({
  _downloads: state.fs.downloads,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _saveMedia: () => dispatch(FsGen.createSaveMedia(Constants.makeDownloadPayload(path))),
  _shareNative: () => dispatch(FsGen.createShareNative(Constants.makeDownloadPayload(path))),
})

const getSaveAction = (stateProps, dispatchProps, path) =>
  isMobile && stateProps._pathItem.type === 'file' && Constants.isMedia(stateProps._pathItem)
    ? stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'camera-roll'))
      ? 'disabled'
      : dispatchProps._saveMedia
    : undefined

const getShareAction = (stateProps, dispatchProps, path) =>
  isMobile && stateProps._pathItem.type === 'file'
    ? stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'share'))
      ? 'disabled'
      : dispatchProps._shareNative
    : undefined

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  confirm:
    ownProps.action === 'save'
      ? getSaveAction(stateProps, dispatchProps, ownProps.path)
      : getShareAction(stateProps, dispatchProps, ownProps.path),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionConfirm'
)(Confirm)
