import * as Container from '../../util/container'
import SyncToggle from './sync-toggle'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  tlfPath: Types.Path
}

export default (ownProps: OwnProps) => {
  const {tlfPath} = ownProps
  const _tlfPathItem = Container.useSelector(state =>
    Constants.getPathItem(state.fs.pathItems, ownProps.tlfPath)
  )
  const _tlfs = Container.useSelector(state => state.fs.tlfs)
  const waiting = Container.useAnyWaiting(Constants.syncToggleWaitingKey)

  const dispatch = Container.useDispatch()
  const disableSync = () => {
    dispatch(FsGen.createSetTlfSyncConfig({enabled: false, tlfPath}))
  }
  const enableSync = () => {
    dispatch(FsGen.createSetTlfSyncConfig({enabled: true, tlfPath}))
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
