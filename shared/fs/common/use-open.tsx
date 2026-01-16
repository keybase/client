import * as C from '@/constants'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type Props = {
  path: T.FS.Path
  destinationPickerIndex?: number
}

export const useOpen = (props: Props) => {
  const {destPicker, pathItems} = useFSState(
    C.useShallow(s => {
      const {destinationPicker, pathItems} = s
      return {destPicker: destinationPicker, pathItems}
    })
  )
  const nav = useSafeNavigation()

  if (typeof props.destinationPickerIndex !== 'number') {
    return () => nav.safeNavigateAppend({props: {path: props.path}, selected: 'fsRoot'})
  }

  const isFolder =
    T.FS.getPathLevel(props.path) <= 3 ||
    FS.getPathItem(pathItems, props.path).type === T.FS.PathType.Folder

  const canOpenInDestinationPicker =
    isFolder &&
    (destPicker.source.type === T.FS.DestinationPickerSource.IncomingShare ||
      (destPicker.source.type === T.FS.DestinationPickerSource.MoveOrCopy &&
        destPicker.source.path !== props.path))

  if (!canOpenInDestinationPicker) {
    return
  }

  const destinationPickerGoTo = () =>
    FS.makeActionsForDestinationPickerOpen((props.destinationPickerIndex || 0) + 1, props.path)

  return destinationPickerGoTo
}
