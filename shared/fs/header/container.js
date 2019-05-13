// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Util from '../../util/kbfs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import FolderHeader from './header'

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
|}

const mapDispatchToProps = (dispatch, {path, routePath}: OwnProps) => ({
  _onChat: () =>
    dispatch(
      Chat2Gen.createPreviewConversation({
        reason: 'files',
        // tlfToParticipantsOrTeamname will route both public and private folders
        // to a private chat, which is exactly what we want.
        ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
      })
    ),
  onBack: () =>
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: routePath,
        otherAction: RouteTreeGen.createNavigateUp(),
      })
    ),
})

const mergeProps = (_, {onBack, _onChat}, {path, routePath}: OwnProps) => {
  const elems = Types.getPathElements(path)
  return {
    onBack,
    onChat: elems.length > 2 ? _onChat : undefined,
    path,
    routePath,
    title: elems.length > 1 ? elems[elems.length - 1] : 'Keybase Files',
  }
}

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'FolderHeader')(
  FolderHeader
)
