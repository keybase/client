import * as C from '../../../constants'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import * as T from '../../../constants/types'
import DestinationPicker from '.'
import {OriginalOrCompressedButton} from '../../../incoming-share'
import {isMobile} from '../../../constants/platform'
import {memoize} from '../../../util/memoize'

type OwnProps = {index: number}

const getIndex = (ownProps: OwnProps) => ownProps.index
const getDestinationParentPath = (dp: T.FS.DestinationPicker, ownProps: OwnProps): T.FS.Path =>
  dp.destinationParentPath[getIndex(ownProps)] ||
  (dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy
    ? T.FS.getPathParent(dp.source.path)
    : T.FS.stringToPath('/keybase'))

const canWrite = memoize(
  (dp: T.FS.DestinationPicker, pathItems: T.FS.PathItems, ownProps: OwnProps) =>
    T.FS.getPathLevel(getDestinationParentPath(dp, ownProps)) > 2 &&
    Constants.getPathItem(pathItems, getDestinationParentPath(dp, ownProps)).writable
)

const canCopy = memoize((dp: T.FS.DestinationPicker, pathItems: T.FS.PathItems, ownProps: OwnProps) => {
  if (!canWrite(dp, pathItems, ownProps)) {
    return false
  }
  if (dp.source.type === T.FS.DestinationPickerSource.IncomingShare) {
    return true
  }
  if (dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy) {
    const source: T.FS.MoveOrCopySource = dp.source
    return getDestinationParentPath(dp, ownProps) !== T.FS.getPathParent(source.path)
  }
  return undefined
})

const canMove = memoize(
  (dp: T.FS.DestinationPicker, pathItems: T.FS.PathItems, ownProps: OwnProps) =>
    canCopy(dp, pathItems, ownProps) &&
    dp.source.type === T.FS.DestinationPickerSource.MoveOrCopy &&
    Constants.pathsInSameTlf(dp.source.path, getDestinationParentPath(dp, ownProps))
)

const canBackUp = isMobile
  ? memoize(
      (dp: T.FS.DestinationPicker, ownProps: OwnProps) =>
        T.FS.getPathLevel(getDestinationParentPath(dp, ownProps)) > 1
    )
  : () => false

const ConnectedDestinationPicker = (ownProps: OwnProps) => {
  const destPicker = C.useFSState(s => s.destinationPicker)
  const isShare = destPicker.source.type === T.FS.DestinationPickerSource.IncomingShare
  const pathItems = C.useFSState(s => s.pathItems)
  const headerRightButton =
    destPicker.source.type === T.FS.DestinationPickerSource.IncomingShare ? (
      <OriginalOrCompressedButton incomingShareItems={destPicker.source.source} />
    ) : undefined

  const nav = Container.useSafeNavigation()

  const newFolderRow = C.useFSState(s => s.dispatch.newFolderRow)
  const moveOrCopy = C.useFSState(s => s.dispatch.moveOrCopy)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const dispatchProps = {
    _onBackUp: (currentPath: T.FS.Path) =>
      Constants.makeActionsForDestinationPickerOpen(getIndex(ownProps) + 1, T.FS.getPathParent(currentPath)),
    _onCopyHere: (destinationParentPath: T.FS.Path) => {
      moveOrCopy(destinationParentPath, 'copy')
      clearModals()
      nav.safeNavigateAppend({props: {path: destinationParentPath}, selected: 'fsRoot'})
    },
    _onMoveHere: (destinationParentPath: T.FS.Path) => {
      moveOrCopy(destinationParentPath, 'move')
      clearModals()
      nav.safeNavigateAppend({props: {path: destinationParentPath}, selected: 'fsRoot'})
    },
    _onNewFolder: (destinationParentPath: T.FS.Path) => {
      newFolderRow(destinationParentPath)
    },
    onBack: () => {
      navigateUp()
    },
    onCancel: () => {
      clearModals()
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
