import type * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import Confirm, {type Props} from './confirm'
import type {FloatingMenuProps} from './types'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
}

const mapStateToProps = (state: Container.TypedState, {path}: OwnProps) => ({
  _pathItemActionMenu: state.fs.pathItemActionMenu,
  size: Constants.getPathItem(state.fs.pathItems, path).size,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {path}: OwnProps) => ({
  _confirm: ({view, previousView}) => {
    dispatch(view === 'confirm-save-media' ? FsGen.createSaveMedia({path}) : FsGen.createShareNative({path}))
    dispatch(FsGen.createSetPathItemActionMenuView({view: previousView}))
  },
})

export default Container.connect(
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
  })
)(Confirm)
