// @flow
import * as Types from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Util from '../../util/kbfs'
import {putActionIfOnPath, navigateUp} from '../../actions/route-tree'
import {namedConnect} from '../../util/container'
import FolderHeader from './header'

const mapDispatchToProps = (dispatch, {path, routePath}) => ({
  onBack: () => dispatch(putActionIfOnPath(routePath, navigateUp())),
  _onChat: () =>
    dispatch(
      Chat2Gen.createPreviewConversation({
        reason: 'files',
        // tlfToParticipantsOrTeamname will route both public and private folders
        // to a private chat, which is exactly what we want.
        ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
      })
    ),
})

const mergeProps = (_, {onBack, _onChat}, {path, routePath}) => {
  const elems = Types.getPathElements(path)
  return {
    path,
    title: elems.length > 1 ? elems[elems.length - 1] : 'Keybase Files',
    onBack,
    onChat: elems.length > 2 ? _onChat : undefined,
    routePath,
  }
}

export default namedConnect(() => ({}), mapDispatchToProps, mergeProps, 'FolderHeader')(FolderHeader)
