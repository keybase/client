import * as Types from '../../constants/types/fs'
import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as React from 'react'
import debounce from 'lodash/debounce'

type Props = {
  onCancel?: () => void
  path: Types.Path
  style?: Styles.StylesCrossPlatform
}

const FolderViewFilter = (props: Props) => {
  const pathItem = C.useFSState(s => C.getPathItem(s.pathItems, props.path))
  const setFolderViewFilter = C.useFSState(s => s.dispatch.setFolderViewFilter)
  const onUpdate = React.useMemo(
    () =>
      debounce((newFilter: string) => {
        setFolderViewFilter(newFilter)
      }),
    [setFolderViewFilter]
  )

  return C.isFolder(props.path, pathItem) && Types.getPathLevel(props.path) > 1 ? (
    <Kb.SearchFilter
      size="small"
      placeholderCentered={true}
      mobileCancelButton={true}
      focusOnMount={Styles.isMobile}
      hotkey="f"
      onCancel={props.onCancel}
      onChange={onUpdate}
      placeholderText="Filter"
      style={props.style}
    />
  ) : null
}

export default FolderViewFilter
