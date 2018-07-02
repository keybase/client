// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Util from '../../util/kbfs'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import FolderHeader from './header.desktop'
import * as StateMappers from '../utils/state-mappers'

const mapStateToProps = (state: TypedState, {path}) => ({
  _kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {path, routePath}) => ({
  _openInFileUI: () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({
    reason: 'files',
    ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
  })),
})

const mergeProps = ({_kbfsEnabled}, {_openInFileUI, _openFinderPopup, onChat}, {path}) => {
  const elems = Types.getPathElements(path)
  return {
    path,
    openInFileUI: _kbfsEnabled ? () => _openInFileUI() : _openFinderPopup,
    onChat: elems.length > 2 ? onChat : undefined,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FolderHeader')
)(FolderHeader)
