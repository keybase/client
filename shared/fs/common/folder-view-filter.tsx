import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as React from 'react'
import debounce from 'lodash/debounce'

type Props = {
  onCancel?: (() => void) | null
  path: Types.Path
  style?: Styles.StylesCrossPlatform | null
}

const FolderViewFilter = (props: Props) => {
  const {filter} = Container.useSelector(state => Constants.getPathUserSetting(state, props.path))
  const pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, props.path))
  const dispatch = Kbfs.useDispatchWhenKbfsIsConnected()
  const onUpdate = React.useMemo(
    () =>
      debounce(
        (newFilter: string) =>
          dispatch(FsGen.createSetFolderViewFilter({filter: newFilter, path: props.path})),
        100
      ),
    [dispatch, props.path]
  )
  React.useEffect(() => () => onUpdate(null), [onUpdate])
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
      value={filter || '' /* not controlled; just initial value */}
    />
  ) : null
}

export default FolderViewFilter
