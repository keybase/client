// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import {memoize2} from '../../util/memoize'
import {namedConnect} from '../../util/container'

type OwnProps = {
  routePath: I.List<string>,
  path: Types.Path,
  destinationPickerIndex?: number,
}

const mapStateToProps = state => ({
  _pathItems: state.fs.pathItems,
  _moveOrCopy: state.fs.moveOrCopy,
})

const mapDispatchToProps = (dispatch, {path, destinationPickerIndex, routePath}: OwnProps) => ({
  _destinationPickerGoTo: () =>
    dispatch(
      FsGen.createMoveOrCopyOpen({
        path,
        routePath,
        currentIndex: destinationPickerIndex || 0 /* make flow happy */,
      })
    ),
  _open: () => dispatch(FsGen.createOpenPathItem({path, routePath})),
})

const isFolder = (stateProps, ownProps: OwnProps) =>
  Types.getPathLevel(ownProps.path) <= 3 ||
  stateProps._pathItems.get(ownProps.path, Constants.unknownPathItem).type === 'folder'

const canOpenInDestinationPicker = memoize2(
  (stateProps, ownProps) =>
    !isFolder(stateProps, ownProps) || stateProps._moveOrCopy.sourceItemPath === ownProps.path
)

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  onOpen:
    typeof ownProps.destinationPickerIndex === 'number'
      ? canOpenInDestinationPicker(stateProps, ownProps)
        ? null
        : dispatchProps._destinationPickerGoTo
      : dispatchProps._open,
  routePath: ownProps.routePath,
  path: ownProps.path,
  destinationPickerIndex: ownProps.destinationPickerIndex,
})

type MergedProps = OwnProps & {
  onOpen: ?() => void,
}

export default namedConnect<OwnProps, _, React.ComponentType<MergedProps>, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedOpenHOC')
