import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {
  routePath: I.List<string>
  path: Types.Path
  destinationPickerIndex?: number
}

const mapStateToProps = state => ({
  _destinationPicker: state.fs.destinationPicker,
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = (dispatch, {path, destinationPickerIndex, routePath}: OwnProps) => ({
  _destinationPickerGoTo: () =>
    Constants.makeActionsForDestinationPickerOpen(destinationPickerIndex + 1, path, routePath).forEach(
      action => dispatch(action)
    ),
  _open: () => dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {path}, selected: 'main'}]})),
})

const isFolder = (stateProps, ownProps: OwnProps) =>
  Types.getPathLevel(ownProps.path) <= 3 ||
  stateProps._pathItems.get(ownProps.path, Constants.unknownPathItem).type === Types.PathType.Folder

const canOpenInDestinationPicker = (stateProps, ownProps) =>
  isFolder(stateProps, ownProps) &&
  (stateProps._destinationPicker.source.type === Types.DestinationPickerSource.IncomingShare ||
    (stateProps._destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy &&
      stateProps._destinationPicker.source.path !== ownProps.path))

type MergedProps = OwnProps & {
  onOpen: () => void | null
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): MergedProps => ({
  onOpen:
    typeof ownProps.destinationPickerIndex === 'number'
      ? canOpenInDestinationPicker(stateProps, ownProps)
        ? dispatchProps._destinationPickerGoTo
        : null
      : dispatchProps._open,

  // We need the inexact spread here because this is a HOC. As such, it must
  // pass down any OwnProps to composed components, even if the HOC typing
  // itself doesn't know about them.
  ...ownProps,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedOpenHOC')
