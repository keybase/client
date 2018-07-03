// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Util from '../../util/kbfs'
import {isMobile} from '../../constants/platform'
import {navigateUp} from '../../actions/route-tree'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import * as StateMappers from '../utils/state-mappers'
import FolderHeader from './header'

const mapStateToProps = (state: TypedState, {path}) => ({
  _kbfsEnabled: isMobile ? false : StateMappers.mapStateToKBFSEnabled(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {path, routePath}) => ({
  _openInFileUI: isMobile ? undefined : () => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: isMobile ? undefined : (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
  onBack: isMobile ? () => dispatch(navigateUp()) : undefined, // TODO: put if on route ...
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({
    reason: 'files',
    ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
  })),
})

const mergeProps = ({_kbfsEnabled}, {onBack, onChat, _openInFileUI, _openFinderPopup}, {path}) => {
  const elems = Types.getPathElements(path)
  return {
    path,
    title: elems.length > 1 ? elems[elems.length - 1] : 'Keybase Files',
    openInFileUI: _kbfsEnabled ? _openInFileUI : _openFinderPopup,
    onBack,
    onChat: elems.length > 2 ? onChat : undefined,
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FolderHeader'))(
  FolderHeader
)
