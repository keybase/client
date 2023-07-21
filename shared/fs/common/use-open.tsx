import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'

type Props = {
  path: Types.Path
  destinationPickerIndex?: number
}

export const useOpen = (props: Props) => {
  const destPicker = Constants.useState(s => s.destinationPicker)
  const pathItems = Constants.useState(s => s.pathItems)
  const nav = Container.useSafeNavigation()

  if (typeof props.destinationPickerIndex !== 'number') {
    return () => nav.safeNavigateAppend({props: {path: props.path}, selected: 'fsRoot'})
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
    Constants.makeActionsForDestinationPickerOpen((props.destinationPickerIndex || 0) + 1, props.path)

  return destinationPickerGoTo
}
