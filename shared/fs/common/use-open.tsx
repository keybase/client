import * as C from '@/constants'
import * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useFsPathItem} from '@/fs/common/hooks'

type Props = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
  path: T.FS.Path
}

export const useOpen = (props: Props) => {
  const pathItem = useFsPathItem(props.path, {loadOnMount: false, subscribe: false})
  const nav = useSafeNavigation()

  if (!props.destinationPickerSource) {
    const knownType = pathItem.type !== T.FS.PathType.Unknown ? pathItem.type : undefined
    const knownTimestamp = pathItem.type === T.FS.PathType.File ? pathItem.lastModifiedTimestamp : undefined
    return () => {
      if (C.isMobile && knownType === T.FS.PathType.File) {
        nav.safeNavigateAppend({
          name: 'fsFilePreview',
          params: {initialLastModifiedTimestamp: knownTimestamp, path: props.path},
        })
      } else {
        nav.safeNavigateAppend({
          name: 'fsRoot',
          params: {initialLastModifiedTimestamp: knownTimestamp, initialPathType: knownType, path: props.path},
        })
      }
    }
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
