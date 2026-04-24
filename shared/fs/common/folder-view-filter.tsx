import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useFsPathItem} from './hooks'
import * as FS from '@/stores/fs'

type Props = {
  filter?: string
  onChangeFilter: (filter: string) => void
  onCancel?: () => void
  path: T.FS.Path
  style?: Kb.Styles.StylesCrossPlatform
}

const FolderViewFilter = (props: Props) => {
  const pathItem = useFsPathItem(props.path)

  return FS.isFolder(props.path, pathItem) && T.FS.getPathLevel(props.path) > 1 ? (
    <Kb.SearchFilter
      size="small"
      placeholderCentered={true}
      mobileCancelButton={true}
      focusOnMount={Kb.Styles.isMobile}
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
