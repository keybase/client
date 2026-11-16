import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useFsPathItem} from './hooks'
import * as FS from '@/constants/fs'

type Props = {
  filter?: string
  onChangeFilter: (filter: string) => void
  onCancel?: () => void
  path: T.FS.Path
  style?: Kb.Styles.StylesCrossPlatform
}

const FolderViewFilter = (props: Props) => {
  const pathItem = useFsPathItem(props.path)

  // Only folder screens draw it, so a path not loaded yet is most likely a folder: drawing it from the
  // start keeps it from popping in (and shifting the header) once the path loads.
  const maybeFolder = FS.isFolder(props.path, pathItem) || pathItem.type === T.FS.PathType.Unknown
  return maybeFolder && T.FS.getPathLevel(props.path) > 1 ? (
    <Kb.SearchFilter
      size="small"
      placeholderCentered={true}
      mobileCancelButton={true}
      focusOnMount={isMobile}
      hotkey="f"
      onCancel={props.onCancel}
      onChange={props.onChangeFilter}
      placeholderText="Filter"
      style={props.style}
      value={props.filter ?? ''}
      valueControlled={true}
    />
  ) : null
}

export default FolderViewFilter
