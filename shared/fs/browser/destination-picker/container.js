// @flow
import * as I from 'immutable'
import {getRouteProps, namedConnect, type RouteProps} from '../../../util/container'
import {memoize} from '../../../util/memoize'
import DestinationPicker from '.'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {isMobile} from '../../../constants/platform'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = RouteProps<
  {|
    index: number,
  |},
  {||}
>

const mapStateToProps = state => ({
  _destinationPicker: state.fs.destinationPicker,
  _pathItems: state.fs.pathItems,
})

const getDestinationParentPath = memoize((stateProps, ownProps: OwnProps) =>
  stateProps._destinationPicker.destinationParentPath.get(
    getRouteProps(ownProps, 'index') || 0,
    stateProps._destinationPicker.source.type === 'move-or-copy'
      ? Types.getPathParent(stateProps._destinationPicker.source.path)
      : Types.stringToPath('/keybase')
  )
)

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _onBackUp: (currentPath: Types.Path) =>
    Constants.makeActionsForDestinationPickerOpen(
      getIndex(ownProps) + 1,
      Types.getPathParent(currentPath),
      I.List() // ownProps.routePath
    ).forEach(action => dispatch(action)),
  _onCopyHere: destinationParentPath => {
    dispatch(FsGen.createCopy({destinationParentPath}))
    dispatch(FsGen.createClearRefreshTag({refreshTag: 'destination-picker'}))
    dispatch(RouteTreeGen.createClearModals())
  },
  _onMoveHere: destinationParentPath => {
    dispatch(FsGen.createMove({destinationParentPath}))
    dispatch(FsGen.createClearRefreshTag({refreshTag: 'destination-picker'}))
    dispatch(RouteTreeGen.createClearModals())
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {path: destinationParentPath}, selected: 'main'}]})
    )
  },
  _onNewFolder: destinationParentPath =>
    dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
  onCancel: () => {
    dispatch(FsGen.createClearRefreshTag({refreshTag: 'destination-picker'}))
    dispatch(RouteTreeGen.createClearModals())
  },
})

const canWrite = memoize(
  (stateProps, ownProps: OwnProps) =>
    Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 2 &&
    stateProps._pathItems.get(getDestinationParentPath(stateProps, ownProps), Constants.unknownPathItem)
      .writable
)

const canCopy = memoize((stateProps, ownProps: OwnProps) => {
  if (!canWrite(stateProps, ownProps)) {
    return false
  }
  if (stateProps._destinationPicker.source.type === 'incoming-share') {
    return true
  }
  if (stateProps._destinationPicker.source.type === 'move-or-copy') {
    const source: Types.MoveOrCopySource = stateProps._destinationPicker.source
    return getDestinationParentPath(stateProps, ownProps) !== Types.getPathParent(source.path)
  }
})

const canMove = memoize(
  (stateProps, ownProps: OwnProps) =>
    canCopy(stateProps, ownProps) &&
    stateProps._destinationPicker.source.type === 'move-or-copy' &&
    Constants.pathsInSameTlf(
      stateProps._destinationPicker.source.path,
      getDestinationParentPath(stateProps, ownProps)
    )
)

const getIndex = memoize((ownProps: OwnProps) => getRouteProps(ownProps, 'index') || 0)
const canBackUp = isMobile
  ? memoize(
      (stateProps, ownProps: OwnProps) =>
        Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 1
    )
  : (s, o) => false

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
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
    routePath: I.List(), // ownProps.routePath,
    targetName,
  }
}

const Connected = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedDestinationPicker'
)(DestinationPicker)

export default Connected
