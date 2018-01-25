// @flow
import * as Types from '../constants/types/fs'
import {connect, type TypedState, type Dispatch} from '../util/container'
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
  _onViewFolder: (Types.Path) => void,
  _onViewFile: (Types.Path) => void,
}

const mapStateToProps = ({fs}: TypedState, {path}: OwnProps) => ({
  type: fs.pathItems.getIn([path, 'type']),
})

const mapDispatchToProps = (dispatch: Dispatch) => {
  return {
    _onViewFolder: (path: Types.Path) => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
    _onViewFile: (path: Types.Path) => console.log("Cannot view files yet. Requested file: " + path),
  }
}

const iconTypes : IconType = {
  folder: isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24',
  file: isMobile ? 'icon-file-24' : 'icon-file-24',
}

const mergeProps = ({type}: StateProps, {_onViewFolder, _onViewFile}: DispatchProps, {path}: OwnProps) => ({
  path,
  name: Types.getPathName(path),
  icon: iconTypes[type],
  onOpen: () => type === 'folder' ? _onViewFolder(path): _onViewFile(path)
})

const RowConnector = connect(mapStateToProps, mapDispatchToProps, mergeProps)
export {RowConnector}
