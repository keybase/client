import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useFsPathItem} from './hooks'
import * as FS from '@/constants/fs'

type Props = {
  onClick: () => void
  path: T.FS.Path
  style?: Kb.Styles.StylesCrossPlatform
}

const FolderViewFilterIcon = (props: Props) => {
  const pathItem = useFsPathItem(props.path)
  return FS.isFolder(props.path, pathItem) && T.FS.getPathLevel(props.path) > 1 ? (
    <Kb.Icon type="iconfont-filter" onClick={props.onClick} padding="tiny" style={props.style} />
  ) : null
}

export default FolderViewFilterIcon
