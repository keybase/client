// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import Share from './share'
import type {FloatingMenuProps} from './types'

type OwnProps = {|
  path: Types.Path,
  floatingMenuProps: FloatingMenuProps,
|}

const mapStateToProps = (state, {path}) => ({
  _downloads: state.fs.downloads,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _confirmSaveMedia: () =>
    dispatch(
      FsGen.createSetPathItemActionMenuView({
        view: Constants.makePathItemActionMenuConfirmView({action: 'save'}),
      })
    ),
  _confirmShareNative: () =>
    dispatch(
      FsGen.createSetPathItemActionMenuView({
        view: Constants.makePathItemActionMenuConfirmView({action: 'send-to-other-app'}),
      })
    ),
  _saveMedia: () => dispatch(FsGen.createSaveMedia(Constants.makeDownloadPayload(path))),
  _shareNative: () => dispatch(FsGen.createShareNative(Constants.makeDownloadPayload(path))),
})

type Actions = {|
  confirmSaveMedia?: () => void,
  confirmShareNative?: () => void,
  saveMedia?: (() => void) | 'disabled',
  shareNative?: (() => void) | 'disabled',
|}

const needConfirm = (file: Types.FilePathItem) => file.size > 50 * 1024 * 1024

const aSave = (menuActions, stateProps, dispatchProps, path) => {
  if (isMobile && stateProps._pathItem.type === 'file' && Constants.isMedia(stateProps._pathItem)) {
    if (needConfirm(stateProps._pathItem)) {
      menuActions.confirmSaveMedia = dispatchProps._confirmSaveMedia
      return
    }
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'camera-roll'))) {
      menuActions.saveMedia = 'disabled'
    } else {
      menuActions.saveMedia = dispatchProps._saveMedia
    }
  }
}

const aShareNative = (menuActions, stateProps, dispatchProps, path) => {
  if (isMobile && stateProps._pathItem.type === 'file') {
    if (needConfirm(stateProps._pathItem)) {
      menuActions.confirmShareNative = dispatchProps._confirmShareNative
      return
    }
    if (stateProps._downloads.find(download => Constants.isPendingDownload(download, path, 'share'))) {
      menuActions.shareNative = 'disabled'
    } else {
      menuActions.shareNative = dispatchProps._shareNative
    }
  }
}

const tlfListAppenders = []
const tlfAppenders = []
const inTlfAppenders = [aSave, aShareNative]

const makeMenuActions = (): Actions => ({
  saveMedia: undefined,
  shareNative: undefined,
})

const getRootMenuActionsByAppenders = (appenders, stateProps, dispatchProps, path: Types.Path): Actions => {
  const menuActions = makeMenuActions()
  appenders.forEach(appender => appender(menuActions, stateProps, dispatchProps, path))
  return menuActions
}

const getRootMenuActionsByPathLevel = (
  pathLevel: number,
  stateProps,
  dispatchProps,
  path: Types.Path
): Actions => {
  switch (pathLevel) {
    case 0:
      // The action is for `/`. This shouldn't be possible.
      return makeMenuActions()
    case 1:
      // The action is for `/keybase`. This shouldn't be possible as we never
      // have a /keybase row, and we don't show ... menu for root view.
      return makeMenuActions()
    case 2:
      // The action is for a tlf list, i.e. /keybase/private, /keybase/public,
      // or /keybase/team.
      return getRootMenuActionsByAppenders(tlfListAppenders, stateProps, dispatchProps, path)
    case 3:
      // The action is for a tlf.
      return getRootMenuActionsByAppenders(tlfAppenders, stateProps, dispatchProps, path)
    default:
      // The action is for something inside a tlf
      return getRootMenuActionsByAppenders(inTlfAppenders, stateProps, dispatchProps, path)
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...getRootMenuActionsByPathLevel(
    Types.getPathLevel(ownProps.path),
    stateProps,
    dispatchProps,
    ownProps.path
  ),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionShare'
)(Share)
