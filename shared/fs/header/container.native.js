// @flow
import * as Types from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Util from '../../util/kbfs'
import {navigateUp} from '../../actions/route-tree'
import {compose, connect, setDisplayName, type Dispatch} from '../../util/container'
import Header from './header.native'

const mapDispatchToProps = (dispatch: Dispatch, {path}) => ({
  onBack: () => dispatch(navigateUp()), // TODO: put if on route ...
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({
    reason: 'files',
    ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
  })),
})

const mergeProps = (stateProps, {onBack, onChat}, {path}) => {
  const elems = Types.getPathElements(path)
  return {
    path,
    title: elems.length > 1 ? elems[elems.length - 1] : 'Keybase Files',
    onBack,
    onChat: elems.length > 2 ? onChat : undefined,
  }
}

export default compose(connect(() => ({}), mapDispatchToProps, mergeProps), setDisplayName('FolderHeader'))(
  Header
)
