// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {Row} from './row'
import {isMobile, isLinux} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path)
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    kbfsEnabled: isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted),
    type: pathItem ? pathItem.type : 'unknown',
  }
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
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
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

const mergeProps = ({_username, type, path, kbfsEnabled}, {_onOpen, _openInFileUI, _openFinderPopup}) => {
  const elems = Types.getPathElements(path)
  return {
    name: elems[elems.length - 1],
    type: type,
    onOpen: () => _onOpen(type, path),
    openInFileUI: kbfsEnabled ? () => _openInFileUI(path) : _openFinderPopup,
    itemStyles: Constants.getItemStyles(elems, type, _username),
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Row'))(Row)
