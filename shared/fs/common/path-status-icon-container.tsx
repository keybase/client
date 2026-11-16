import * as T from '@/constants/types'
import PathStatusIcon from './path-status-icon'
import {isPrefetchStatusSeedOnly, useFsPathItem, useFsTlfs, useFsTlfsSettled} from './hooks'
import {useFsUploadStatus, useKbfsDaemonStatus} from './status'
import * as FS from '@/constants/fs'

type OwnPropsPathItem = {
  path: T.FS.Path
  showTooltipOnPressMobile?: boolean
}

// Draws nothing rather than a guess:
// - an unknown TLF reads as not synced, but until the favorites load comes back that is only a guess
//   (a failed load settles it too: "online only" is then the best there is)
// - a seeded item whose prefetch status nobody passed reads "waiting to sync" until its stat lands
export const shownPathStatusIcon = (
  tlfsSettled: boolean,
  tlf: T.Immutable<T.FS.Tlf>,
  prefetchSeedOnly: boolean,
  statusIcon: T.FS.PathStatusIcon
): T.FS.PathStatusIcon | undefined => {
  if (!tlfsSettled && tlf === FS.unknownTlf && statusIcon === T.FS.NonUploadStaticSyncStatus.OnlineOnly) {
    return undefined
  }
  if (prefetchSeedOnly && statusIcon === T.FS.NonUploadStaticSyncStatus.AwaitingToSync) {
    return undefined
  }
  return statusIcon
}

const PathStatusIconPathItem = (ownProps: OwnPropsPathItem) => {
  const _pathItem = useFsPathItem(ownProps.path)
  const _tlf = FS.getTlfFromPath(useFsTlfs(), ownProps.path)
  const tlfsSettled = useFsTlfsSettled()
  const _uploads = useFsUploadStatus().syncingPaths
  const _kbfsDaemonStatus = useKbfsDaemonStatus()
  const props = {
    isFolder: _pathItem.type === T.FS.PathType.Folder,
    showTooltipOnPressMobile: ownProps.showTooltipOnPressMobile,
    statusIcon: shownPathStatusIcon(
      tlfsSettled,
      _tlf,
      isPrefetchStatusSeedOnly(_pathItem),
      FS.getPathStatusIconInMergeProps(_kbfsDaemonStatus, _tlf, _pathItem, _uploads, ownProps.path)
    ),
  }
  return <PathStatusIcon {...props} />
}

type OwnPropsTlfType = {
  tlfType?: T.FS.TlfType
}

const PathStatusIconTlfType = (ownProps: OwnPropsTlfType) => {
  const tlfs = useFsTlfs()
  const _uploads = useFsUploadStatus()
  const _kbfsDaemonStatus = useKbfsDaemonStatus()
  const _tlfList = ownProps.tlfType ? FS.getTlfListFromType(tlfs, ownProps.tlfType) : new Map()
  const props = {
    isFolder: true,
    isTlfType: true,
    statusIcon:
      ownProps.tlfType &&
      FS.getUploadIconForTlfType(_kbfsDaemonStatus, _uploads, _tlfList, ownProps.tlfType),
  }
  return <PathStatusIcon {...props} />
}

type OwnProps = {
  path: T.FS.Path
  showTooltipOnPressMobile?: boolean
}

const PathStatusIconConnected = (props: OwnProps) =>
  T.FS.getPathLevel(props.path) > 2 ? (
    <PathStatusIconPathItem path={props.path} showTooltipOnPressMobile={props.showTooltipOnPressMobile} />
  ) : (
    <PathStatusIconTlfType tlfType={T.FS.getTlfTypeFromPath(props.path)} />
  )

export default PathStatusIconConnected
