import * as C from '@/constants'
import * as T from '@/constants/types'
import SyncToggle from './sync-toggle'

type OwnProps = {
  tlfPath: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {tlfPath} = ownProps
  const _tlfPathItem = C.useFSState(s => C.FS.getPathItem(s.pathItems, ownProps.tlfPath))
  const _tlfs = C.useFSState(s => s.tlfs)
  const waiting = C.Waiting.useAnyWaiting(C.FS.syncToggleWaitingKey)

  const setTlfSyncConfig = C.useFSState(s => s.dispatch.setTlfSyncConfig)

  const disableSync = () => {
    setTlfSyncConfig(tlfPath, false)
  }
  const enableSync = () => {
    setTlfSyncConfig(tlfPath, true)
  }
  const syncConfig = C.FS.getTlfFromPath(_tlfs, tlfPath).syncConfig
  const props = {
    disableSync,
    enableSync,
    // Disable sync when the TLF is empty and it's not enabled yet.
    // Band-aid fix for when new user has a non-exisitent TLF which we
    // can't enable sync for yet.
    hideSyncToggle:
      syncConfig.mode === T.FS.TlfSyncMode.Disabled &&
      _tlfPathItem.type === T.FS.PathType.Folder &&
      !_tlfPathItem.children.size,
    syncConfig,
    waiting,
  }
  return <SyncToggle {...props} />
}

export default Container
