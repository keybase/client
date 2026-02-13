import * as T from '@/constants/types'
import * as C from '@/constants'
import PathStatusIcon from './path-status-icon'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnPropsPathItem = {
  path: T.FS.Path
  showTooltipOnPressMobile?: boolean
}

const PathStatusIconPathItem = (ownProps: OwnPropsPathItem) => {
  const {_kbfsDaemonStatus, _pathItem, _tlf, _uploads} = useFSState(
    C.useShallow(s => {
      const _kbfsDaemonStatus = s.kbfsDaemonStatus
      const _pathItem = FS.getPathItem(s.pathItems, ownProps.path)
      const _tlf = FS.getTlfFromPath(s.tlfs, ownProps.path)
      const _uploads = s.uploads.syncingPaths
      return {_kbfsDaemonStatus, _pathItem, _tlf, _uploads}
    })
  )
  const props = {
    isFolder: _pathItem.type === T.FS.PathType.Folder,
    showTooltipOnPressMobile: ownProps.showTooltipOnPressMobile,
    statusIcon: FS.getPathStatusIconInMergeProps(
      _kbfsDaemonStatus,
      _tlf,
      _pathItem,
      _uploads,
      ownProps.path
    ),
  }
  return <PathStatusIcon {...props} />
}

type OwnPropsTlfType = {
  tlfType?: T.FS.TlfType
}

const PathStatusIconTlfType = (ownProps: OwnPropsTlfType) => {
  const {_kbfsDaemonStatus, _tlfList, _uploads} = useFSState(
    C.useShallow(s => {
      const _kbfsDaemonStatus = s.kbfsDaemonStatus
      const _tlfList = ownProps.tlfType ? FS.getTlfListFromType(s.tlfs, ownProps.tlfType) : new Map()
      const _uploads = s.uploads
      return {_kbfsDaemonStatus, _tlfList, _uploads}
    })
  )
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
