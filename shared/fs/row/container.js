// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FSGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {Row} from './row'

type OwnProps = {
  path: Types.Path, }

type DispatchProps = {
  _onOpen: (type: Types.PathType, path: Types.Path) => void,
  _openInFileUI: (path: Types.Path) => void,
  _onAction: (path: Types.Path) => void,
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
      dispatch(FSGen.createDownload({path}))
      console.log('Cannot view files yet. Requested file: ' + Types.pathToString(path))
    }
  },
  _openInFileUI: (path: Types.Path) => dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _onAction: (
    path: Types.Path,
    targetRect?: ?ClientRect,
  ) => dispatch(
    navigateAppend([{
      props: {
        onHidden: () => dispatch(navigateUp()),
        //targetRect,
        targetRect: {...targetRect, right: targetRect.right - 220}, // TODO: fix this
      },
      selected: 'rowAction',
    }])
  ),
})

const mergeProps = ({_username, type, path}, {_onOpen, _openInFileUI, _onAction}: DispatchProps) => {
  const elems = Types.getPathElements(path)
  return {
    name: elems[elems.length - 1],
    type: type,
    onOpen: () => _onOpen(type, path),
    openInFileUI: () => _openInFileUI(path),
    onAction: (event: SyntheticEvent<>) => _onAction(
      path,
      (event.target: window.HTMLElement).getBoundingClientRect(),
    ),
    itemStyles: Constants.getItemStyles(elems, type, _username),
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Row'))(Row)
