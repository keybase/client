import * as Container from '../../util/container'
import SyncToggle from './sync-toggle'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {
  tlfPath: Types.Path
}

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => ({
    _tlfPathItem: Constants.getPathItem(state.fs.pathItems, ownProps.tlfPath),
    _tlfs: state.fs.tlfs,
    waiting: anyWaiting(state, Constants.syncToggleWaitingKey),
  }),
  (dispatch, {tlfPath}: OwnProps) => ({
    disableSync: () => dispatch(FsGen.createSetTlfSyncConfig({enabled: false, tlfPath})),
    enableSync: () => dispatch(FsGen.createSetTlfSyncConfig({enabled: true, tlfPath})),
  }),
  (stateProps, dispatchProps, {tlfPath}: OwnProps) => {
    const syncConfig = Constants.getTlfFromPath(stateProps._tlfs, tlfPath).syncConfig
    return {
      // Disable sync when the TLF is empty and it's not enabled yet.
      // Band-aid fix for when new user has a non-exisitent TLF which we
      // can't enable sync for yet.
      hideSyncToggle:
        syncConfig.mode === Types.TlfSyncMode.Disabled &&
        stateProps._tlfPathItem.type === Types.PathType.Folder &&
        !stateProps._tlfPathItem.children.size,
      syncConfig,
      waiting: stateProps.waiting,
      ...dispatchProps,
    }
  }
)(SyncToggle)
