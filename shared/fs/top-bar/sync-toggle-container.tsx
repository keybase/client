import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import SyncToggle from './sync-toggle'

type OwnProps = {
  tlfPath: Types.Path
}

export default (ownProps: OwnProps) => {
  const {tlfPath} = ownProps
  const _tlfPathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, ownProps.tlfPath))
  const _tlfs = Constants.useState(s => s.tlfs)
  const waiting = Container.useAnyWaiting(Constants.syncToggleWaitingKey)

  const setTlfSyncConfig = Constants.useState(s => s.dispatch.setTlfSyncConfig)

  const disableSync = () => {
    setTlfSyncConfig(tlfPath, false)
  }
  const enableSync = () => {
    setTlfSyncConfig(tlfPath, true)
  }
  const syncConfig = Constants.getTlfFromPath(_tlfs, tlfPath).syncConfig
  const props = {
    disableSync,
    enableSync,
    // Disable sync when the TLF is empty and it's not enabled yet.
    // Band-aid fix for when new user has a non-exisitent TLF which we
    // can't enable sync for yet.
    hideSyncToggle:
      syncConfig.mode === Types.TlfSyncMode.Disabled &&
      _tlfPathItem.type === Types.PathType.Folder &&
      !_tlfPathItem.children.size,
    syncConfig,
    waiting,
  }
  return <SyncToggle {...props} />
}
