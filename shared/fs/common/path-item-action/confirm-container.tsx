import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import Confirm, {Props} from './confirm'
import {FloatingMenuProps} from './types'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
}

const mapStateToProps = (state: Container.TypedState, {path}: OwnProps) => ({
  _pathItemActionMenu: state.fs.pathItemActionMenu,
  size: state.fs.pathItems.get(path, Constants.unknownPathItem).size,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {path}: OwnProps) => ({
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

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...ownProps,
    action:
      stateProps._pathItemActionMenu.view === 'confirm-save-media'
        ? 'save-media'
        : ('send-to-other-app' as Props['action']),
    confirm: () => dispatchProps._confirm(stateProps._pathItemActionMenu),
    size: stateProps.size,
  }),
  'PathItemActionConfirm'
)(Confirm)
