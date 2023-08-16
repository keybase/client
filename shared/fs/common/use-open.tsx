import * as C from '../../constants'
import * as T from '../../constants/types'
import * as Container from '../../util/container'

type Props = {
  path: T.FS.Path
  destinationPickerIndex?: number
}

export const useOpen = (props: Props) => {
  const destPicker = C.useFSState(s => s.destinationPicker)
  const pathItems = C.useFSState(s => s.pathItems)
  const nav = Container.useSafeNavigation()

  if (typeof props.destinationPickerIndex !== 'number') {
    return () => nav.safeNavigateAppend({props: {path: props.path}, selected: 'fsRoot'})
  }

  const isFolder =
    T.FS.getPathLevel(props.path) <= 3 || C.getPathItem(pathItems, props.path).type === T.FS.PathType.Folder

  const canOpenInDestinationPicker =
    isFolder &&
    (destPicker.source.type === T.FS.DestinationPickerSource.IncomingShare ||
      (destPicker.source.type === T.FS.DestinationPickerSource.MoveOrCopy &&
        destPicker.source.path !== props.path))

  if (!canOpenInDestinationPicker) {
    return
  }

  const destinationPickerGoTo = () =>
    C.makeActionsForDestinationPickerOpen((props.destinationPickerIndex || 0) + 1, props.path)

  return destinationPickerGoTo
}
