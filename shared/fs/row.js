// @flow
import * as Types from '../constants/types/fs'
import {connect, type TypedState} from '../util/container'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'
import {type IconType} from '../common-adapters/icon'

type OwnProps = {
  path: Types.Path,
}

type StateProps = {
  type: Types.PathType,
}

type DispatchProps = {
  _onOpen: (Types.Path, Types.PathType) => void,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  type: state.fs.pathItems.getIn([path, 'type']),
})

const mapDispatchToProps = (dispatch: Dispatch) => {
  const onViewFolder = (path: Types.Path) => () => dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
  const onViewFile = (path: Types.Path) => () => console.log("Cannot view files yet. Requested file: " + path)
  return {
    _onOpen: (p: Types.Path, t: Types.PathType) => t === 'folder' ? onViewFolder(p): onViewFile(p)
  }
}

const iconTypes : IconType = {
  folder: isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24',
  file: isMobile ? 'icon-file-24' : 'icon-file-24',
}

const mergeProps = ({type}: StateProps, {_onOpen}: DispatchProps, {path}: OwnProps) => ({
  path,
  name: Types.getPathName(path),
  icon: iconTypes[type],
  onOpen: () => _onOpen(path, type),
})

const RowConnector = connect(mapStateToProps, mapDispatchToProps, mergeProps)
export {RowConnector}
