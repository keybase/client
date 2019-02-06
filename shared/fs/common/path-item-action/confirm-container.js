// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import Confirm from './confirm'
import type {FloatingMenuProps} from './types'

type OwnProps = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
|}

const mapStateToProps = (state, {path}) => ({
  _pathItemActionMenu: state.fs.pathItemActionMenu,
  size: state.fs.pathItems.get(path, Constants.unknownPathItem).size,
})

const mapDispatchToProps = (dispatch, {action, path}: OwnProps) => ({
  _confirm: ({view, previousView}) => {
    const key = Constants.makeDownloadKey(path)
    dispatch(
      view === 'confirm-save-media'
        ? FsGen.createSaveMedia({key, path})
        : FsGen.createShareNative({key, path})
    )
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
    dispatch(FsGen.createSetPathItemActionMenuView({view: previousView}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  action: stateProps._pathItemActionMenu.view === 'confirm-save-media' ? 'save-media' : 'send-to-other-app',
  confirm: () => dispatchProps._confirm(stateProps._pathItemActionMenu),
  size: stateProps.size,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionConfirm'
)(Confirm)
