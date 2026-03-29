import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import debounce from 'lodash/debounce'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type Props = {
  filter?: string
  onChangeFilter: (filter: string) => void
  onCancel?: () => void
  path: T.FS.Path
  style?: Kb.Styles.StylesCrossPlatform
}

const FolderViewFilter = (props: Props) => {
  const pathItem = useFSState(s => FS.getPathItem(s.pathItems, props.path))
  const onUpdate = debounce((newFilter: string) => {
    props.onChangeFilter(newFilter)
  })

  return FS.isFolder(props.path, pathItem) && T.FS.getPathLevel(props.path) > 1 ? (
    <Kb.SearchFilter
      size="small"
      placeholderCentered={true}
      mobileCancelButton={true}
      focusOnMount={Kb.Styles.isMobile}
      hotkey="f"
      onCancel={props.onCancel}
      onChange={onUpdate}
      placeholderText="Filter"
      style={props.style}
      value={props.filter ?? ''}
      valueControlled={true}
    />
  ) : null
}

export default FolderViewFilter
