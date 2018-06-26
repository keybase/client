// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateAppend, navigateTo, navigateUp} from '../../actions/route-tree'
import {isMobile} from '../../constants/platform'
import FolderHeader from './header.desktop'
import * as StateMappers from '../utils/state-mappers'

const mapStateToProps = (state: TypedState, {path}) => ({
  _kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
})

const mergeProps = ({_kbfsEnabled}, {_openInFileUI, _openFinderPopup}, {path}) => {
  return {
    path,
    openInFileUI: _kbfsEnabled ? () => _openInFileUI(path) : _openFinderPopup,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FolderHeader')
)(FolderHeader)
