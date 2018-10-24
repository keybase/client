// @flow
import {compose, connect, setDisplayName} from '../../util/container'
import memoize from 'memoize-one'
import DestinationPicker from '.'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = state => ({
  _moveOrCopy: state.fs.moveOrCopy,
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(navigateUp()),
  _onCopyHere: () => {
    dispatch(FsGen.createCopy())
    dispatch(navigateUp())
  },
  _onMoveHere: () => {
    dispatch(FsGen.createMove())
    dispatch(navigateUp())
  },
  _onNewFolder: (parentPath: Types.Path) => dispatch(FsGen.createNewFolderRow({parentPath})),
})

const destinationParentPathIsWritable = memoize(
  stateProps =>
    Types.getPathLevel(stateProps._moveOrCopy.destinationParentPath) > 2 &&
    stateProps._pathItems.get(stateProps._moveOrCopy.destinationParentPath, Constants.unknownPathItem)
      .writable
)

const mergeProps = (stateProps, dispatchProps) => ({
  onCancel: dispatchProps.onCancel,
  onCopyHere: destinationParentPathIsWritable(stateProps) ? dispatchProps._onCopyHere : null,
  onMoveHere:
    destinationParentPathIsWritable(stateProps) &&
    Constants.pathsInSameTlf(
      stateProps._moveOrCopy.sourceItemPath,
      stateProps._moveOrCopy.destinationParentPath
    )
      ? dispatchProps._onMoveHere
      : null,
  onNewFolder: destinationParentPathIsWritable(stateProps)
    ? () => dispatchProps._onNewFolder(stateProps._moveOrCopy.destinationParentPath)
    : null,
  path: stateProps._moveOrCopy.destinationParentPath,
  targetName: Types.getPathName(stateProps._moveOrCopy.sourceItemPath),
  targetIconSpec: Constants.getItemStyles(
    Types.getPathElements(stateProps._moveOrCopy.sourceItemPath),
    stateProps._pathItems.get(stateProps._moveOrCopy.sourceItemPath, Constants.unknownPathItem).type
  ).iconSpec,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('ConnectedDestinationPicker')
)(DestinationPicker)
