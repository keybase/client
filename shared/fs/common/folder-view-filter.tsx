import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import debounce from 'lodash/debounce'

type Props = {
  onCancel?: () => void
  path: T.FS.Path
  style?: Kb.Styles.StylesCrossPlatform
}

const FolderViewFilter = (props: Props) => {
  const pathItem = C.useFSState(s => C.FS.getPathItem(s.pathItems, props.path))
  const setFolderViewFilter = C.useFSState(s => s.dispatch.setFolderViewFilter)
  const onUpdate = React.useMemo(
    () =>
      debounce((newFilter: string) => {
        setFolderViewFilter(newFilter)
      }),
    [setFolderViewFilter]
  )

  return C.FS.isFolder(props.path, pathItem) && T.FS.getPathLevel(props.path) > 1 ? (
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
    />
  ) : null
}

export default FolderViewFilter
