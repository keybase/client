import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/fs'
import DestinationPicker from '.'
import {OriginalOrCompressedButton} from '../../../incoming-share'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'

type OwnProps = Container.RouteProps<'destinationPicker'>

const getIndex = (ownProps: OwnProps) => ownProps.route.params?.index ?? 0
const getDestinationParentPath = (dp: Types.DestinationPicker, ownProps: OwnProps): Types.Path =>
  dp.destinationParentPath[getIndex(ownProps)] ||
  (dp.source.type === Types.DestinationPickerSource.MoveOrCopy
    ? Types.getPathParent(dp.source.path)
    : Types.stringToPath('/keybase'))

const canWrite = memoize(
  (dp: Types.DestinationPicker, pathItems: Types.PathItems, ownProps: OwnProps) =>
    Types.getPathLevel(getDestinationParentPath(dp, ownProps)) > 2 &&
    Constants.getPathItem(pathItems, getDestinationParentPath(dp, ownProps)).writable
)

const canCopy = memoize((dp: Types.DestinationPicker, pathItems: Types.PathItems, ownProps: OwnProps) => {
  if (!canWrite(dp, pathItems, ownProps)) {
    return false
  }
  if (dp.source.type === Types.DestinationPickerSource.IncomingShare) {
    return true
  }
  if (dp.source.type === Types.DestinationPickerSource.MoveOrCopy) {
    const source: Types.MoveOrCopySource = dp.source
    return getDestinationParentPath(dp, ownProps) !== Types.getPathParent(source.path)
  }
  return undefined
})

const canMove = memoize(
  (dp: Types.DestinationPicker, pathItems: Types.PathItems, ownProps: OwnProps) =>
    canCopy(dp, pathItems, ownProps) &&
    dp.source.type === Types.DestinationPickerSource.MoveOrCopy &&
    Constants.pathsInSameTlf(dp.source.path, getDestinationParentPath(dp, ownProps))
)

const canBackUp = isMobile
  ? memoize(
      (dp: Types.DestinationPicker, ownProps: OwnProps) =>
        Types.getPathLevel(getDestinationParentPath(dp, ownProps)) > 1
    )
  : () => false

const ConnectedDestinationPicker = (ownProps: OwnProps) => {
  const destPicker = Container.useSelector(state => state.fs.destinationPicker)
  const isShare = destPicker.source.type === Types.DestinationPickerSource.IncomingShare
  const pathItems = Container.useSelector(state => state.fs.pathItems)
  const headerRightButton =
    destPicker.source.type === Types.DestinationPickerSource.IncomingShare ? (
      <OriginalOrCompressedButton incomingShareItems={destPicker.source.source} />
    ) : undefined

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const dispatchProps = {
    _onBackUp: (currentPath: Types.Path) =>
      Constants.makeActionsForDestinationPickerOpen(
        getIndex(ownProps) + 1,
        Types.getPathParent(currentPath),
        nav.safeNavigateAppendPayload
      ).forEach(action => dispatch(action)),
    _onCopyHere: destinationParentPath => {
      dispatch(FsGen.createCopy({destinationParentPath}))
      dispatch(RouteTreeGen.createClearModals())
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {path: destinationParentPath}, selected: 'fsRoot'}],
        })
      )
    },
    _onMoveHere: destinationParentPath => {
      dispatch(FsGen.createMove({destinationParentPath}))
      dispatch(RouteTreeGen.createClearModals())
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {path: destinationParentPath}, selected: 'fsRoot'}],
        })
      )
    },
    _onNewFolder: destinationParentPath =>
      dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onCancel: () => {
      dispatch(RouteTreeGen.createClearModals())
    },
  }

  const index = getIndex(ownProps)
  const showHeaderBackInsteadOfCancel = isShare // && index > 0
  const targetName = Constants.getDestinationPickerPathName(destPicker)
  const props = {
    headerRightButton,
    index,
    isShare,
    // If we are are dealing with incoming share, the first view is root,
    // so rely on the header back button instead of showing a separate row
    // for going to parent directory.
    onBack: showHeaderBackInsteadOfCancel ? dispatchProps.onBack : undefined,
    onBackUp:
      isShare || !canBackUp(destPicker, ownProps)
        ? undefined
        : () => dispatchProps._onBackUp(getDestinationParentPath(destPicker, ownProps)),
    onCancel: showHeaderBackInsteadOfCancel ? undefined : dispatchProps.onCancel,
    onCopyHere: canCopy(destPicker, pathItems, ownProps)
      ? () => dispatchProps._onCopyHere(getDestinationParentPath(destPicker, ownProps))
      : undefined,
    onMoveHere: canMove(destPicker, pathItems, ownProps)
      ? () => dispatchProps._onMoveHere(getDestinationParentPath(destPicker, ownProps))
      : undefined,
    onNewFolder:
      canWrite(destPicker, pathItems, ownProps) && !isShare
        ? () => dispatchProps._onNewFolder(getDestinationParentPath(destPicker, ownProps))
        : undefined,
    parentPath: getDestinationParentPath(destPicker, ownProps),
    targetName,
  }

  return <DestinationPicker {...props} />
}

export default ConnectedDestinationPicker
