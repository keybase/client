import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'

type Props = {
  path: Types.Path
  destinationPickerIndex?: number
}

export const useOpen = (props: Props) => {
  const destPicker = Container.useSelector(state => state.fs.destinationPicker)
  const pathItems = Container.useSelector(state => state.fs.pathItems)
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  if (typeof props.destinationPickerIndex !== 'number') {
    return () =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {path: props.path}, selected: 'fsRoot'}]}))
  }

  const isFolder =
    Types.getPathLevel(props.path) <= 3 ||
    Constants.getPathItem(pathItems, props.path).type === Types.PathType.Folder

  const canOpenInDestinationPicker =
    isFolder &&
    (destPicker.source.type === Types.DestinationPickerSource.IncomingShare ||
      (destPicker.source.type === Types.DestinationPickerSource.MoveOrCopy &&
        destPicker.source.path !== props.path))

  if (!canOpenInDestinationPicker) {
    return
  }

  const destinationPickerGoTo = () =>
    Constants.makeActionsForDestinationPickerOpen(
      (props.destinationPickerIndex || 0) + 1,
      props.path,
      nav.safeNavigateAppendPayload
    ).forEach(action => dispatch(action))

  return destinationPickerGoTo
}
