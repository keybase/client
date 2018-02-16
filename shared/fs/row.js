// @flow
import * as Types from '../constants/types/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../util/container'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'
import type {IconType} from '../common-adapters/icon'

type OwnProps = {
  path: Types.Path,
}

type DispatchProps = {
  _onOpen: (type: Types.PathType, path: Types.Path) => void,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
  const pathItem = state.fs.pathItems.get(path)
  return {path, type: pathItem ? pathItem.type : 'unknown'}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpen: (type: Types.PathType, path: Types.Path) => {
    if (type === 'folder') {
      dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
    } else {
      console.log('Cannot view files yet. Requested file: ' + Types.pathToString(path))
    }
  },
})

const iconMap = {
  file: isMobile ? 'icon-file-24' : 'icon-file-24',
  folder: isMobile ? 'icon-folder-private-24' : 'icon-folder-private-24',
  symlink: isMobile ? 'icon-file-24' : 'icon-file-24',
}

const mergeProps = ({type, path}, {_onOpen}: DispatchProps) => {
  const icon: IconType = iconMap[Types.pathTypeToString(type)]

  return {
    icon,
    name: Types.getPathName(path),
    onOpen: () => _onOpen(type, path),
    path,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FileRow'))
