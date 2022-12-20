import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

// The behavior is to only show spinner when user first time lands on a screen
// and when don't have the data that drives it yet. Since RPCs happen
// automatically, we are just relying on whether data is available from the
// redux store.

type OwnProps = {path: Types.Path}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      progressIndicator: {
        height: 18,
        width: 18,
      },
    } as const)
)

const Loading = (op: OwnProps) => {
  const {path} = op
  const _pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const _tlfsLoaded = Container.useSelector(state => !!state.fs.tlfs.private.size)
  const parsedPath = Constants.parsePath(path)
  let show = false

  switch (parsedPath.kind) {
    case Types.PathKind.TlfList:
      show = !_tlfsLoaded
      break
    case Types.PathKind.TeamTlf:
    case Types.PathKind.GroupTlf:
    case Types.PathKind.InTeamTlf:
    case Types.PathKind.InGroupTlf:
      // Only show the loading spinner when we are first-time loading a pathItem.
      // If we already have content to show, just don't show spinner anymore even
      // if we are loading.
      if (_pathItem.type === Types.PathType.Unknown) {
        show = true
        break
      }
      if (_pathItem.type === Types.PathType.Folder && _pathItem.progress === Types.ProgressType.Pending) {
        show = true
        break
      }
      break
    case Types.PathKind.Root:
    default:
  }

  return show ? <Kb.ProgressIndicator style={styles.progressIndicator} /> : null
}
export default Loading
