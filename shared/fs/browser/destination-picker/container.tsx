import * as Container from '../../../util/container'
import {memoize} from '../../../util/memoize'
import DestinationPicker from '.'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {isMobile} from '../../../constants/platform'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as React from 'react'

type OwnProps = Container.RouteProps<{
  index: number
  isIncomingShare: boolean
}>

const getIndex = (ownProps: OwnProps) => Container.getRouteProps(ownProps, 'index', 0)
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
  const pathItems = Container.useSelector(state => state.fs.pathItems)

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
          path: [{props: {path: destinationParentPath}, selected: 'main'}],
        })
      )
    },
    _onMoveHere: destinationParentPath => {
      dispatch(FsGen.createMove({destinationParentPath}))
      dispatch(RouteTreeGen.createClearModals())
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {path: destinationParentPath}, selected: 'main'}],
        })
      )
    },
    _onNewFolder: destinationParentPath =>
      dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
    onCancel: () => {
      dispatch(RouteTreeGen.createClearModals())
    },
  }

  const targetName = Constants.getDestinationPickerPathName(destPicker)
  const props = {
    index: getIndex(ownProps),
    onBackUp: canBackUp(destPicker, ownProps)
      ? () => dispatchProps._onBackUp(getDestinationParentPath(destPicker, ownProps))
      : undefined,
    onCancel: dispatchProps.onCancel,
    onCopyHere: canCopy(destPicker, pathItems, ownProps)
      ? () => dispatchProps._onCopyHere(getDestinationParentPath(destPicker, ownProps))
      : undefined,
    onMoveHere: canMove(destPicker, pathItems, ownProps)
      ? () => dispatchProps._onMoveHere(getDestinationParentPath(destPicker, ownProps))
      : undefined,
    onNewFolder: canWrite(destPicker, pathItems, ownProps)
      ? () => dispatchProps._onNewFolder(getDestinationParentPath(destPicker, ownProps))
      : undefined,
    parentPath: getDestinationParentPath(destPicker, ownProps),
    targetName,
  }

  return <DestinationPicker {...props} />
}

export default ConnectedDestinationPicker
