// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'
import Share from './share'
import type {FloatingMenuProps} from './types'

type OwnProps = {|
  path: Types.Path,
  floatingMenuProps: FloatingMenuProps,
|}

const mapStateToProps = (state, {path}) => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
  _downloads: state.fs.downloads,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _confirmShareNative: (toCancel: ?string) => {
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'confirm-send-to-other-app'}))
    toCancel && dispatch(FsGen.createCancelDownload({key: toCancel}))
  },
  _saveMedia: (toCancel: ?string) => {
    const key = Constants.makeDownloadKey(path)
    dispatch(FsGen.createSaveMedia({key, path}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
    toCancel && dispatch(FsGen.createCancelDownload({key: toCancel}))
  },
  _shareNative: (toCancel: ?string) => {
    const key = Constants.makeDownloadKey(path)
    dispatch(FsGen.createShareNative({key, path}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
    toCancel && dispatch(FsGen.createCancelDownload({key: toCancel}))
  },
})

const needConfirm = (file: Types.FilePathItem) => file.size > 50 * 1024 * 1024

const getDownloadingState = memoize(stateProps => {
  if (!stateProps._downloadKey) {
    return {done: true, saving: false, sharing: false}
  }
  const download = stateProps._downloads.get(stateProps._downloadKey)
  const intent = download && download.meta.intent
  const done = !download || download.state.completePortion === 1
  if (!intent) {
    return {done, saving: false, sharing: false}
  }
  return {done, saving: intent === 'camera-roll', sharing: intent === 'share'}
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  if (Types.getPathLevel(ownProps.path) < 3) {
    return {...ownProps, shouldHideMenu: false}
  }

  let saveMedia
  let shareNative
  const {saving, sharing, done} = getDownloadingState(stateProps)
  if (Constants.isMedia(stateProps._pathItem)) {
    // save is enabled for media files only
    saveMedia = saving
      ? 'in-progress'
      : () => dispatchProps._saveMedia(sharing ? stateProps._downloadKey : null)
  }
  if (isMobile && stateProps._pathItem.type === 'file') {
    // share is enabled for all files
    if (sharing) {
      shareNative = 'in-progress'
    } else {
      shareNative = needConfirm(stateProps._pathItem)
        ? () => dispatchProps._confirmShareNative(saving ? stateProps._downloadKey : null)
        : () => dispatchProps._shareNative(saving ? stateProps._downloadKey : null)
    }
  }
  return {
    ...ownProps,
    saveMedia,
    shareNative,
    shouldHideMenu: (saving || sharing) && done,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionShare'
)(Share)
