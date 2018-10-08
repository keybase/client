// @flow
import * as Types from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Util from '../../util/kbfs'
import {isMobile} from '../../constants/platform'
import {navigateUp} from '../../actions/route-tree'
import {compose, connect, setDisplayName} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import FolderHeader from './header'

const mapDispatchToProps = (dispatch, {path, routePath}) => ({
  onBack: isMobile ? () => dispatch(navigateUp()) : undefined, // TODO: put if on route ...
  onChat: () =>
    dispatch(
      Chat2Gen.createPreviewConversation({
        reason: 'files',
        // tlfToParticipantsOrTeamname will route both public and private folders
        // to a private chat, which is exactly what we want.
        ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
      })
    ),
})

const mergeProps = (_, {onBack, onChat}, {path, routePath}) => {
  const elems = Types.getPathElements(path)
  return {
    path,
    title: elems.length > 1 ? elems[elems.length - 1] : 'Keybase Files',
    onBack,
    onChat: elems.length > 2 ? onChat : undefined,
    routePath,
  }
}

export default compose(
  connect(
    () => ({}),
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('FolderHeader'),
  OpenHOC
)(FolderHeader)
