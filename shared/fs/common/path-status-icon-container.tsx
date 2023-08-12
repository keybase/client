import * as Types from '../../constants/types/fs'
import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import PathStatusIcon from './path-status-icon'

type OwnPropsPathItem = {
  path: Types.Path
  showTooltipOnPressMobile?: boolean
}

const PathStatusIconPathItem = (ownProps: OwnPropsPathItem) => {
  const _kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const _pathItem = C.useFSState(s => C.getPathItem(s.pathItems, ownProps.path))
  const _tlf = C.useFSState(s => C.getTlfFromPath(s.tlfs, ownProps.path))
  const _uploads = C.useFSState(s => s.uploads.syncingPaths)
  const props = {
    isFolder: _pathItem.type === Types.PathType.Folder,
    showTooltipOnPressMobile: ownProps.showTooltipOnPressMobile,
    statusIcon: Constants.getPathStatusIconInMergeProps(
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
  tlfType?: Types.TlfType
}

const PathStatusIconTlfType = (ownProps: OwnPropsTlfType) => {
  const _kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const _tlfList = C.useFSState(s =>
    ownProps.tlfType ? Constants.getTlfListFromType(s.tlfs, ownProps.tlfType) : new Map()
  )
  const _uploads = C.useFSState(s => s.uploads)
  const props = {
    isFolder: true,
    isTlfType: true,
    statusIcon:
      ownProps.tlfType &&
      Constants.getUploadIconForTlfType(_kbfsDaemonStatus, _uploads, _tlfList, ownProps.tlfType),
  }
  return <PathStatusIcon {...props} />
}

type OwnProps = {
  path: Types.Path
  showTooltipOnPressMobile?: boolean
}

const PathStatusIconConnected = (props: OwnProps) =>
  Types.getPathLevel(props.path) > 2 ? (
    <PathStatusIconPathItem path={props.path} showTooltipOnPressMobile={props.showTooltipOnPressMobile} />
  ) : (
    <PathStatusIconTlfType tlfType={Types.getTlfTypeFromPath(props.path)} />
  )

export default PathStatusIconConnected
