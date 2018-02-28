// @flow
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../util/container'
import {navigateAppend} from '../actions/route-tree'
import * as FsGen from '../actions/fs-gen'

type OwnProps = {
  path: Types.Path,
}

type DispatchProps = {
  _onOpen: (type: Types.PathType, path: Types.Path) => void,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
  const pathItem = state.fs.pathItems.get(path)
  const _username = state.config.username || undefined
  return {_username, path, type: pathItem ? pathItem.type : 'unknown'}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpen: (type: Types.PathType, path: Types.Path) => {
    if (type === 'folder') {
      dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
    } else {
      dispatch(FsGen.createDownload({path}))
      console.log('Cannot view files yet. Requested file: ' + Types.pathToString(path))
    }
  },
})

const mergeProps = ({_username, type, path}, {_onOpen}: DispatchProps) => {
  const itemStyles: Types.ItemStyles = Constants.getItemStyles(path, type, _username)
  const elems = Types.getPathElements(path)

  return {
    elems: elems,
    itemStyles,
    name: elems[elems.length - 1],
    onOpen: () => _onOpen(type, path),
    path,
    type,
    visibility: Types.getVisibilityFromElems(elems),
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FileRow'))
