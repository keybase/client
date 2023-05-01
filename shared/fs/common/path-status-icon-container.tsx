import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import PathStatusIcon from './path-status-icon'

type OwnPropsPathItem = {
  path: Types.Path
  showTooltipOnPressMobile?: boolean
}

const PathStatusIconPathItem = (ownProps: OwnPropsPathItem) => {
  const _kbfsDaemonStatus = Container.useSelector(state => state.fs.kbfsDaemonStatus)
  const _pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, ownProps.path))
  const _tlf = Container.useSelector(state => Constants.getTlfFromPath(state.fs.tlfs, ownProps.path))
  const _uploads = Container.useSelector(state => state.fs.uploads.syncingPaths)
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
  const _kbfsDaemonStatus = Container.useSelector(state => state.fs.kbfsDaemonStatus)
  const _tlfList = Container.useSelector(state =>
    ownProps.tlfType ? Constants.getTlfListFromType(state.fs.tlfs, ownProps.tlfType) : new Map()
  )
  const _uploads = Container.useSelector(state => state.fs.uploads)
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
