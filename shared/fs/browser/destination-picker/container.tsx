import * as Container from '../../../util/container'
import {memoize} from '../../../util/memoize'
import DestinationPicker from '.'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {TypedState} from '../../../constants/reducer'
import * as FsGen from '../../../actions/fs-gen'
import {isMobile} from '../../../constants/platform'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {
  index: number
}
type OwnPropsWithSafeNavigation = Container.PropsWithSafeNavigation<OwnProps> &
  Container.RouteProps<{index: number}>

const mapStateToProps = (state: TypedState) => ({
  _destinationPicker: state.fs.destinationPicker,
  _pathItems: state.fs.pathItems,
})

type StateProps = ReturnType<typeof mapStateToProps>

const getIndex = (ownProps: OwnPropsWithSafeNavigation) => Container.getRouteProps(ownProps, 'index', 0)
const getDestinationParentPath = (stateProps: StateProps, ownProps: OwnPropsWithSafeNavigation): Types.Path =>
  stateProps._destinationPicker.destinationParentPath.get(
    getIndex(ownProps),
    stateProps._destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy
      ? Types.getPathParent(stateProps._destinationPicker.source.path)
      : Types.stringToPath('/keybase')
  )

const mapDispatchToProps = (dispatch, ownProps: OwnPropsWithSafeNavigation) => ({
  _onBackUp: (currentPath: Types.Path) =>
    Constants.makeActionsForDestinationPickerOpen(
      getIndex(ownProps) + 1,
      Types.getPathParent(currentPath),
      ownProps.safeNavigateAppendPayload
    ).forEach(action => dispatch(action)),
  _onCopyHere: destinationParentPath => {
    dispatch(FsGen.createCopy({destinationParentPath}))
    dispatch(RouteTreeGen.createClearModals())
  },
  _onMoveHere: destinationParentPath => {
    dispatch(FsGen.createMove({destinationParentPath}))
    dispatch(RouteTreeGen.createClearModals())
    dispatch(
      ownProps.safeNavigateAppendPayload({path: [{props: {path: destinationParentPath}, selected: 'main'}]})
    )
  },
  _onNewFolder: destinationParentPath =>
    dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
  onCancel: () => {
    dispatch(RouteTreeGen.createClearModals())
  },
})

type DispatchProps = ReturnType<typeof mapDispatchToProps>

const canWrite = memoize(
  (stateProps: StateProps, ownProps: OwnPropsWithSafeNavigation) =>
    Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 2 &&
    stateProps._pathItems.get(getDestinationParentPath(stateProps, ownProps), Constants.unknownPathItem)
      .writable
)

const canCopy = memoize((stateProps: StateProps, ownProps: OwnPropsWithSafeNavigation) => {
  if (!canWrite(stateProps, ownProps)) {
    return false
  }
  if (stateProps._destinationPicker.source.type === Types.DestinationPickerSource.IncomingShare) {
    return true
  }
  if (stateProps._destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy) {
    const source: Types.MoveOrCopySource = stateProps._destinationPicker.source
    return getDestinationParentPath(stateProps, ownProps) !== Types.getPathParent(source.path)
  }
  return undefined
})

const canMove = memoize(
  (stateProps: StateProps, ownProps: OwnPropsWithSafeNavigation) =>
    canCopy(stateProps, ownProps) &&
    stateProps._destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy &&
    Constants.pathsInSameTlf(
      stateProps._destinationPicker.source.path,
      getDestinationParentPath(stateProps, ownProps)
    )
)

const canBackUp = isMobile
  ? memoize(
      (stateProps, ownProps: OwnPropsWithSafeNavigation) =>
        Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 1
    )
  : () => false

const mergeProps = (
  stateProps: StateProps,
  dispatchProps: DispatchProps,
  ownProps: OwnPropsWithSafeNavigation
) => {
  const targetName = Constants.getDestinationPickerPathName(stateProps._destinationPicker)
  return {
    index: getIndex(ownProps),
    onBackUp: canBackUp(stateProps, ownProps)
      ? () => dispatchProps._onBackUp(getDestinationParentPath(stateProps, ownProps))
      : null,
    onCancel: dispatchProps.onCancel,
    onCopyHere: canCopy(stateProps, ownProps)
      ? () => dispatchProps._onCopyHere(getDestinationParentPath(stateProps, ownProps))
      : null,
    onMoveHere: canMove(stateProps, ownProps)
      ? () => dispatchProps._onMoveHere(getDestinationParentPath(stateProps, ownProps))
      : null,
    onNewFolder: canWrite(stateProps, ownProps)
      ? () => dispatchProps._onNewFolder(getDestinationParentPath(stateProps, ownProps))
      : null,
    parentPath: getDestinationParentPath(stateProps, ownProps),
    targetName,
  }
}

const Connected = Container.withSafeNavigation(
  Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedDestinationPicker')(
    DestinationPicker
  )
)

export default Connected
