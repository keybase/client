// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FSGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'
import {Row} from './row'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  return {_username, path, pathItem}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpen: (type: Types.PathType, path: Types.Path) => {
    if (type === 'folder') {
      dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
    } else {
      console.log('Cannot view files yet. Requested file: ' + Types.pathToString(path))
    }
  },
  _openInFileUI: (path: Types.Path) => dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _onAction: (path: Types.Path, targetRect?: ?ClientRect) =>
    dispatch(
      navigateAppend([
        {
          props: {
            path,
            position: 'bottom right',
            targetRect,
          },
          selected: 'rowAction',
        },
      ])
    ),
})

const mergeProps = ({_username, path, pathItem}, {_onOpen, _openInFileUI, _onAction}) => {
  const elems = Types.getPathElements(path)
  return {
    name: elems[elems.length - 1],
    type: pathItem.type,
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter,
    onOpen: () => _onOpen(pathItem.type, path),
    openInFileUI: () => _openInFileUI(path),
    onAction: (event: SyntheticEvent<>) =>
      _onAction(path, (event.target: window.HTMLElement).getBoundingClientRect()),
    itemStyles: Constants.getItemStyles(elems, pathItem.type, _username),
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Row'))(Row)
