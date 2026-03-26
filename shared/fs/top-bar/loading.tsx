import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

// The behavior is to only show spinner when user first time lands on a screen
// and when don't have the data that drives it yet. Since RPCs happen
// automatically, we are just relying on whether data is available from the store.

type OwnProps = {path: T.FS.Path}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      progressIndicator: {
        height: 18,
        width: 18,
      },
    }) as const
)

const Loading = (op: OwnProps) => {
  const {path} = op
  const {_pathItem, _tlfsLoaded} = useFSState(
    C.useShallow(s => {
      const _pathItem = FS.getPathItem(s.pathItems, path)
      const _tlfsLoaded = !!s.tlfs.private.size
      return {_pathItem, _tlfsLoaded}
    })
  )
  const parsedPath = FS.parsePath(path)
  let show = false

  switch (parsedPath.kind) {
    case T.FS.PathKind.TlfList:
      show = !_tlfsLoaded
      break
    case T.FS.PathKind.TeamTlf:
    case T.FS.PathKind.GroupTlf:
    case T.FS.PathKind.InTeamTlf:
    case T.FS.PathKind.InGroupTlf:
      // Only show the loading spinner when we are first-time loading a pathItem.
      // If we already have content to show, just don't show spinner anymore even
      // if we are loading.
      if (_pathItem.type === T.FS.PathType.Unknown) {
        show = true
        break
      }
      if (_pathItem.type === T.FS.PathType.Folder && _pathItem.progress === T.FS.ProgressType.Pending) {
        show = true
        break
      }
      break
    case T.FS.PathKind.Root:
    default:
  }

  return show ? <Kb.ProgressIndicator style={styles.progressIndicator} /> : null
}
export default Loading
