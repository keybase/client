import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useFsPathItem} from './hooks'
import * as FS from '@/stores/fs'

type Props = {
  filter?: string | undefined
  onChangeFilter: (filter: string) => void
  onCancel?: (() => void) | undefined
  path: T.FS.Path
  style?: Kb.Styles.StylesCrossPlatform | undefined
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
      {...(props.onCancel === undefined ? {} : {onCancel: props.onCancel})}
      onChange={props.onChangeFilter}
      placeholderText="Filter"
      {...(props.style === undefined ? {} : {style: props.style})}
      value={props.filter ?? ''}
      valueControlled={true}
    />
  ) : null
}

export default FolderViewFilter
