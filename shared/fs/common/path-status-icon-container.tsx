import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import PathStatusIcon from './path-status-icon'

type OwnPropsPathItem = {
  path: Types.Path
  showTooltipOnPressMobile?: boolean
}

const PathStatusIconPathItem = Container.connect(
  (state: Container.TypedState, ownProps: OwnPropsPathItem) => ({
    _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    _pathItem: Constants.getPathItem(state.fs.pathItems, ownProps.path),
    _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
    _uploads: state.fs.uploads.syncingPaths,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnPropsPathItem) => ({
    isFolder: stateProps._pathItem.type === Types.PathType.Folder,
    showTooltipOnPressMobile: ownProps.showTooltipOnPressMobile,
    statusIcon: Constants.getPathStatusIconInMergeProps(
      stateProps._kbfsDaemonStatus,
      stateProps._tlf,
      stateProps._pathItem,
      stateProps._uploads,
      ownProps.path
    ),
  })
)(PathStatusIcon)

type OwnPropsTlfType = {
  tlfType?: Types.TlfType
}

const PathStatusIconTlfType = Container.connect(
  (state: Container.TypedState, ownProps: OwnPropsTlfType) => ({
    _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    _tlfList: ownProps.tlfType ? Constants.getTlfListFromType(state.fs.tlfs, ownProps.tlfType) : new Map(),
    _uploads: state.fs.uploads,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnPropsTlfType) => ({
    isFolder: true,
    isTlfType: true,
    statusIcon:
      ownProps.tlfType &&
      Constants.getUploadIconForTlfType(
        stateProps._kbfsDaemonStatus,
        stateProps._uploads,
        stateProps._tlfList,
        ownProps.tlfType
      ),
  })
)(PathStatusIcon)

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
