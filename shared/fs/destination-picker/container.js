// @flow
import {namedConnect} from '../../util/container'
import {memoize1, memoize2} from '../../util/memoize'
import DestinationPicker from '.'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {isMobile} from '../../constants/platform'
import {navigateUp, putActionIfOnPath} from '../../actions/route-tree'

const mapStateToProps = state => ({
  _moveOrCopy: state.fs.moveOrCopy,
  _pathItems: state.fs.pathItems,
})

const getDestinationParentPath = memoize2((stateProps, ownProps) =>
  stateProps._moveOrCopy.destinationParentPath.get(
    ownProps.routeProps.get('index', 0),
    Types.getPathParent(stateProps._moveOrCopy.sourceItemPath)
  )
)

const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () => dispatch(FsGen.createCancelMoveOrCopy()),
  _onCopyHere: destinationParentPath => {
    dispatch(FsGen.createCopy({destinationParentPath}))
    dispatch(FsGen.createCancelMoveOrCopy())
  },
  _onMoveHere: destinationParentPath => {
    dispatch(FsGen.createMove({destinationParentPath}))
    dispatch(FsGen.createCancelMoveOrCopy())
  },
  _onNewFolder: destinationParentPath =>
    dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
  _onBackUp: () => dispatch(putActionIfOnPath(ownProps.routePath, navigateUp())),
})

const canWrite = memoize2(
  (stateProps, ownProps) =>
    Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 2 &&
    stateProps._pathItems.get(getDestinationParentPath(stateProps, ownProps), Constants.unknownPathItem)
      .writable
)

const canCopy = memoize2(
  (stateProps, ownProps) =>
    canWrite(stateProps, ownProps) &&
    getDestinationParentPath(stateProps, ownProps) !==
      Types.getPathParent(stateProps._moveOrCopy.sourceItemPath)
)

const canMove = memoize2(
  (stateProps, ownProps) =>
    canCopy(stateProps, ownProps) &&
    Constants.pathsInSameTlf(
      stateProps._moveOrCopy.sourceItemPath,
      getDestinationParentPath(stateProps, ownProps)
    )
)

const getIndex = memoize1(ownProps => ownProps.routeProps.get('index', 0))
const canBackUp = isMobile
  ? memoize2((stateProps, ownProps) => Types.getPathLevel(getDestinationParentPath(stateProps, ownProps)) > 1)
  : (s, o) => false

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  index: getIndex(ownProps),
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
  onBackUp: canBackUp(stateProps, ownProps) ? dispatchProps._onBackUp : null,
  path: getDestinationParentPath(stateProps, ownProps),
  routePath: ownProps.routePath,
  targetName: Types.getPathName(stateProps._moveOrCopy.sourceItemPath),
  targetIconSpec: Constants.getItemStyles(
    Types.getPathElements(stateProps._moveOrCopy.sourceItemPath),
    stateProps._pathItems.get(stateProps._moveOrCopy.sourceItemPath, Constants.unknownPathItem).type
  ).iconSpec,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedDestinationPicker')(
  DestinationPicker
)
