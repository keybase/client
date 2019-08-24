import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/typed-connect'
import SyncStatus from './sync-status'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, ownProps) => ({
  _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  _pathItem: state.fs.pathItems.get(ownProps.path, Constants.unknownPathItem),
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
  _uploads: state.fs.uploads.syncingPaths,
})

const mapDispatchToProps = () => ({})

const mergeProps = (stateProps, _, ownProps: OwnProps) => {
  const status = Constants.getSyncStatusInMergeProps(
    stateProps._kbfsDaemonStatus,
    stateProps._tlf,
    stateProps._pathItem,
    stateProps._uploads,
    ownProps.path
  )
  return {
    folder: stateProps._pathItem.type === Types.PathType.Folder,
    status,
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'SyncStatus')(SyncStatus)
