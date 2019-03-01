// @flow
import {namedConnect, type RouteProps} from '../../util/container'
import {memoize} from '../../util/memoize'
import DestinationPicker from '.'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {isMobile} from '../../constants/platform'

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
    ownProps.routeProps.get('index', 0),
    stateProps._destinationPicker.type === 'move-or-copy'
      ? Types.getPathParent(stateProps._destinationPicker.sourceItemPath)
      : Types.stringToPath('/keybase')
  )
)

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _onBackUpIncomingShare: (currentPath: Types.Path) =>
    dispatch(
      FsGen.createIncomingShareOpen({
        currentIndex: getIndex(ownProps),
        path: Types.getPathParent(currentPath),
        routePath: ownProps.routePath,
      })
    ),
  _onBackUpMoveOrCopy: (currentPath: Types.Path) =>
    dispatch(
      FsGen.createMoveOrCopyOpen({
        currentIndex: getIndex(ownProps),
        path: Types.getPathParent(currentPath),
        routePath: ownProps.routePath,
      })
    ),
  _onCopyHere: destinationParentPath => {
    dispatch(FsGen.createCopy({destinationParentPath}))
    dispatch(FsGen.createCloseDestinationPicker())
  },
  _onMoveHere: destinationParentPath => {
    dispatch(FsGen.createMove({destinationParentPath}))
    dispatch(FsGen.createOpenPathInFilesTab({path: destinationParentPath, routePath: ownProps.routePath}))
  },
  _onNewFolder: destinationParentPath =>
    dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
  onCancel: () => dispatch(FsGen.createCloseDestinationPicker()),
})

const canWrite = memoize(
  (stateProps, ownProps: OwnProps) =>
    Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 2 &&
    stateProps._pathItems.get(getDestinationParentPath(stateProps, ownProps), Constants.unknownPathItem)
      .writable
)

const canCopy = memoize(
  (stateProps, ownProps: OwnProps) =>
    canWrite(stateProps, ownProps) &&
    (stateProps._destinationPicker.type === 'incoming-share' ||
      getDestinationParentPath(stateProps, ownProps) !==
        // $FlowIssue ¯\_(ツ)_/¯
        Types.getPathParent(stateProps._destinationPicker.sourceItemPath))
)

const canMove = memoize(
  (stateProps, ownProps: OwnProps) =>
    canCopy(stateProps, ownProps) &&
    stateProps._destinationPicker.type === 'move-or-copy' &&
    Constants.pathsInSameTlf(
      stateProps._destinationPicker.sourceItemPath,
      getDestinationParentPath(stateProps, ownProps)
    )
)

const getIndex = memoize((ownProps: OwnProps) => ownProps.routeProps.get('index', 0))
const canBackUp = isMobile
  ? memoize(
      (stateProps, ownProps: OwnProps) =>
        Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 1
    )
  : (s, o) => false

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const targetName = Constants.getDestinationPickerPathName(stateProps._destinationPicker)
  const [targetNameWithoutExtension, targetExtension] = Constants.splitFileNameAndExtension(targetName)
  return {
    index: getIndex(ownProps),
    onBackUp: canBackUp(stateProps, ownProps)
      ? stateProps._destinationPicker.type === 'move-or-copy'
        ? () => dispatchProps._onBackUpMoveOrCopy(getDestinationParentPath(stateProps, ownProps))
        : () => dispatchProps._onBackUpIncomingShare(getDestinationParentPath(stateProps, ownProps))
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
    routePath: ownProps.routePath,
    targetExtension,
    targetName,
    targetNameWithoutExtension,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedDestinationPicker'
)(DestinationPicker)
