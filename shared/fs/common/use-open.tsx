import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useFsPathItem} from './hooks'

type Props = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
  path: T.FS.Path
}

export const useOpen = (props: Props) => {
  const pathItem = useFsPathItem(props.path, {loadOnMount: false})
  const nav = useSafeNavigation()

  if (!props.destinationPickerSource) {
    return () => nav.safeNavigateAppend({name: 'fsRoot', params: {path: props.path}})
  }

  const destinationPickerSource = props.destinationPickerSource
  const isFolder = T.FS.getPathLevel(props.path) <= 3 || pathItem.type === T.FS.PathType.Folder

  const canOpenInDestinationPicker =
    isFolder &&
    (destinationPickerSource.type === T.FS.DestinationPickerSource.IncomingShare
      ? true
      : destinationPickerSource.path !== props.path)

  if (!canOpenInDestinationPicker) {
    return
  }

  const destinationPickerGoTo = () =>
    nav.safeNavigateAppend({
      name: 'destinationPicker',
      params: {parentPath: props.path, source: destinationPickerSource},
    })

  return destinationPickerGoTo
}
