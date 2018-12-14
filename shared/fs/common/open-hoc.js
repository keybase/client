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
  _moveOrCopy: state.fs.moveOrCopy,
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = (dispatch, {path, destinationPickerIndex, routePath}: OwnProps) => ({
  _destinationPickerGoTo: () =>
    dispatch(
      FsGen.createMoveOrCopyOpen({
        currentIndex: destinationPickerIndex || 0,
        path,
        routePath /* make flow happy */,
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

type MergedProps = OwnProps & {
  onOpen: ?() => void,
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): MergedProps => ({
  onOpen:
    typeof ownProps.destinationPickerIndex === 'number'
      ? canOpenInDestinationPicker(stateProps, ownProps)
        ? null
        : dispatchProps._destinationPickerGoTo
      : dispatchProps._open,
  // We need the inexact spread here because this is a HOC. As such, it must
  // pass down any OwnProps to composed components, even if the HOC typing
  // itself doesn't know about them.
  // $FlowIssue thus, ignore the warning here.
  ...ownProps,
})

export default namedConnect<OwnProps, _, React.ComponentType<MergedProps>, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedOpenHOC'
)
