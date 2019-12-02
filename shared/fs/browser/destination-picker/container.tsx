import * as Container from '../../../util/container'
import {memoize} from '../../../util/memoize'
import DestinationPicker from '.'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {TypedState} from '../../../constants/reducer'
import * as FsGen from '../../../actions/fs-gen'
import {isMobile} from '../../../constants/platform'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {
  index: number
}
type OwnPropsWithSafeNavigation = Container.PropsWithSafeNavigation<OwnProps> &
  Container.RouteProps<{index: number}>

const getIndex = (ownProps: OwnPropsWithSafeNavigation) => Container.getRouteProps(ownProps, 'index', 0)
const getDestinationParentPath = (
  dp: Types.DestinationPicker,
  ownProps: OwnPropsWithSafeNavigation
): Types.Path =>
  dp.destinationParentPath[getIndex(ownProps)] ||
  (dp.source.type === Types.DestinationPickerSource.MoveOrCopy
    ? Types.getPathParent(dp.source.path)
    : Types.stringToPath('/keybase'))

const canWrite = memoize(
  (dp: Types.DestinationPicker, pathItems: Types.PathItems, ownProps: OwnPropsWithSafeNavigation) =>
    Types.getPathLevel(getDestinationParentPath(dp, ownProps)) > 2 &&
    Constants.getPathItem(pathItems, getDestinationParentPath(dp, ownProps)).writable
)

const canCopy = memoize(
  (dp: Types.DestinationPicker, pathItems: Types.PathItems, ownProps: OwnPropsWithSafeNavigation) => {
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
  }
)

const canMove = memoize(
  (dp: Types.DestinationPicker, pathItems: Types.PathItems, ownProps: OwnPropsWithSafeNavigation) =>
    canCopy(dp, pathItems, ownProps) &&
    dp.source.type === Types.DestinationPickerSource.MoveOrCopy &&
    Constants.pathsInSameTlf(dp.source.path, getDestinationParentPath(dp, ownProps))
)

const canBackUp = isMobile
  ? memoize(
      (dp: Types.DestinationPicker, ownProps: OwnPropsWithSafeNavigation) =>
        Types.getPathLevel(getDestinationParentPath(dp, ownProps)) > 1
    )
  : () => false

const Connected = Container.withSafeNavigation(
  Container.namedConnect(
    (state: TypedState) => ({
      _destinationPicker: state.fs.destinationPicker,
      _pathItems: state.fs.pathItems,
    }),
    (dispatch, ownProps: OwnPropsWithSafeNavigation) => ({
      _onBackUp: (currentPath: Types.Path) =>
        Constants.makeActionsForDestinationPickerOpen(
          getIndex(ownProps) + 1,
          Types.getPathParent(currentPath),
          ownProps.safeNavigateAppendPayload
        ).forEach(action => dispatch(action)),
      _onCopyHere: destinationParentPath => {
        dispatch(FsGen.createCopy({destinationParentPath}))
        dispatch(RouteTreeGen.createClearModals())
        dispatch(
          ownProps.safeNavigateAppendPayload({
            path: [{props: {path: destinationParentPath}, selected: 'main'}],
          })
        )
      },
      _onMoveHere: destinationParentPath => {
        dispatch(FsGen.createMove({destinationParentPath}))
        dispatch(RouteTreeGen.createClearModals())
        dispatch(
          ownProps.safeNavigateAppendPayload({
            path: [{props: {path: destinationParentPath}, selected: 'main'}],
          })
        )
      },
      _onNewFolder: destinationParentPath =>
        dispatch(FsGen.createNewFolderRow({parentPath: destinationParentPath})),
      onCancel: () => {
        dispatch(RouteTreeGen.createClearModals())
      },
    }),
    (stateProps, dispatchProps, ownProps: OwnPropsWithSafeNavigation) => {
      const targetName = Constants.getDestinationPickerPathName(stateProps._destinationPicker)
      return {
        index: getIndex(ownProps),
        onBackUp: canBackUp(stateProps._destinationPicker, ownProps)
          ? () => dispatchProps._onBackUp(getDestinationParentPath(stateProps._destinationPicker, ownProps))
          : null,
        onCancel: dispatchProps.onCancel,
        onCopyHere: canCopy(stateProps._destinationPicker, stateProps._pathItems, ownProps)
          ? () => dispatchProps._onCopyHere(getDestinationParentPath(stateProps._destinationPicker, ownProps))
          : null,
        onMoveHere: canMove(stateProps._destinationPicker, stateProps._pathItems, ownProps)
          ? () => dispatchProps._onMoveHere(getDestinationParentPath(stateProps._destinationPicker, ownProps))
          : null,
        onNewFolder: canWrite(stateProps._destinationPicker, stateProps._pathItems, ownProps)
          ? () =>
              dispatchProps._onNewFolder(getDestinationParentPath(stateProps._destinationPicker, ownProps))
          : null,
        parentPath: getDestinationParentPath(stateProps._destinationPicker, ownProps),
        targetName,
      }
    },
    'ConnectedDestinationPicker'
  )(DestinationPicker)
)

export default Connected
