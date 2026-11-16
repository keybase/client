import * as T from '@/constants/types'
import PathStatusIcon from './path-status-icon'
import {useFsPathItem, useFsTlfs} from './hooks'
import {useFsUploadStatus, useKbfsDaemonStatus} from './status'
import * as FS from '@/constants/fs'

type OwnPropsPathItem = {
  path: T.FS.Path
  showTooltipOnPressMobile?: boolean
}

// An unknown TLF reads as not synced; before the favorites load that is only a guess, so draw nothing
// rather than "online only" for a folder that may be synced
export const shownPathStatusIcon = (
  tlfs: T.Immutable<T.FS.Tlfs>,
  tlf: T.Immutable<T.FS.Tlf>,
  statusIcon: T.FS.PathStatusIcon
): T.FS.PathStatusIcon | undefined =>
  !tlfs.loaded && tlf === FS.unknownTlf && statusIcon === T.FS.NonUploadStaticSyncStatus.OnlineOnly
    ? undefined
    : statusIcon

const PathStatusIconPathItem = (ownProps: OwnPropsPathItem) => {
  const _pathItem = useFsPathItem(ownProps.path)
  const tlfs = useFsTlfs()
  const _tlf = FS.getTlfFromPath(tlfs, ownProps.path)
  const _uploads = useFsUploadStatus().syncingPaths
  const _kbfsDaemonStatus = useKbfsDaemonStatus()
  const props = {
    isFolder: _pathItem.type === T.FS.PathType.Folder,
    showTooltipOnPressMobile: ownProps.showTooltipOnPressMobile,
    statusIcon: shownPathStatusIcon(
      tlfs,
      _tlf,
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
