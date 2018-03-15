// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {Row} from './row'
import {isMobile, isLinux} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    kbfsEnabled: isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted),
    pathItem,
  }
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
  _onAction: (path: Types.Path, type: Types.PathType, targetRect?: ?ClientRect) => {
    // We may not have the folder loaded yet, but will need metadata to know
    // folder entry types in the popup. So dispatch an action now to load it.
    type === 'folder' && dispatch(FSGen.createFolderListLoad({path}))
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
    )
  },
  _openFinderPopup: isMobile
    ? () => undefined
    : (evt?: SyntheticEvent<>) =>
        dispatch(
          navigateAppend([
            {
              props: {
                targetRect: evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
                position: 'bottom right',
                onHidden: () => dispatch(navigateUp()),
                onInstall: () => dispatch(FsGen.createInstallFuse()),
              },
              selected: 'finderAction',
            },
          ])
        ),
})

const mergeProps = ({_username, path, pathItem, kbfsEnabled}, {_onOpen, _openInFileUI, _onAction, _openFinderPopup}) => {
  const itemStyles = Constants.getItemStyles(Types.getPathElements(path), pathItem.type, _username)
  return {
    name: pathItem.name,
    type: pathItem.type,
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter,
    onOpen: () => _onOpen(pathItem.type, path),
    openInFileUI: kbfsEnabled ? () => _openInFileUI(path) : _openFinderPopup,
    onAction: (event: SyntheticEvent<>) =>
      _onAction(
        path,
        pathItem.type,
        isMobile ? undefined : (event.target: window.HTMLElement).getBoundingClientRect()
      ),
    itemStyles,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Row'))(Row)
