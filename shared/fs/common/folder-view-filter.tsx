import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as React from 'react'
import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import debounce from 'lodash/debounce'

type Props = {
  onCancel?: (() => void) | null
  path: Types.Path
  style?: Styles.StylesCrossPlatform | null
}

const FolderViewFilter = (props: Props) => {
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, props.path))

  const dispatch = Container.useDispatch()
  const onUpdate = React.useMemo(
    () =>
      debounce((newFilter: string) => {
        dispatch(FsGen.createSetFolderViewFilter({filter: newFilter}))
      }),
    [dispatch]
  )

  return Constants.isFolder(props.path, pathItem) && Types.getPathLevel(props.path) > 1 ? (
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
