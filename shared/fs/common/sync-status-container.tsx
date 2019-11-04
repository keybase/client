import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import SyncStatus from './sync-status'

type OwnPropsPathItem = {
  path: Types.Path
}

const SyncStatusPathItem = Container.connect(
  (state: Container.TypedState, ownProps: OwnPropsPathItem) => ({
    _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    _pathItem: state.fs.pathItems.get(ownProps.path, Constants.unknownPathItem),
    _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
    _uploads: state.fs.uploads.syncingPaths,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnPropsPathItem) => ({
    isFolder: stateProps._pathItem.type === Types.PathType.Folder,
    syncStatus: Constants.getSyncStatusInMergeProps(
      stateProps._kbfsDaemonStatus,
      stateProps._tlf,
      stateProps._pathItem,
      stateProps._uploads,
      ownProps.path
    ),
  })
)(SyncStatus)

type OwnPropsTlfType = {
  tlfType?: Types.TlfType
}

const SyncStatusTlfType = Container.connect(
  (state: Container.TypedState, ownProps: OwnPropsTlfType) => ({
    _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    _tlfList: ownProps.tlfType ? Constants.getTlfListFromType(state.fs.tlfs, ownProps.tlfType) : new Map(),
    _uploads: state.fs.uploads,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnPropsTlfType) => ({
    isFolder: true,
    isTlfType: true,
    syncStatus:
      ownProps.tlfType &&
      Constants.getUploadIconForTlfType(
        stateProps._kbfsDaemonStatus,
        stateProps._uploads,
        stateProps._tlfList,
        ownProps.tlfType
      ),
  })
)(SyncStatus)

type OwnProps = {
  path: Types.Path
}

const SyncStatusConnected = (props: OwnProps) =>
  Types.getPathLevel(props.path) > 2 ? (
    <SyncStatusPathItem path={props.path} />
  ) : (
    <SyncStatusTlfType tlfType={Types.getTlfTypeFromPath(props.path)} />
  )

export default SyncStatusConnected
