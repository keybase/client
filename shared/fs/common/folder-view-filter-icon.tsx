import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type * as Styles from '@/styles'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type Props = {
  onClick: () => void
  path: T.FS.Path
  pathItem: T.FS.PathItem
  style?: Styles.StylesCrossPlatform
}

const FolderViewFilterIcon = (props: Props) =>
  FS.isFolder(props.path, props.pathItem) && T.FS.getPathLevel(props.path) > 1 ? (
    <Kb.Icon type="iconfont-filter" onClick={props.onClick} padding="tiny" style={props.style} />
  ) : null

type OwnProps = Omit<Props, 'pathItem'>

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = useFSState(s => FS.getPathItem(s.pathItems, path))
  const props = {
    ...ownProps,
    pathItem,
  }
  return <FolderViewFilterIcon {...props} />
}

export default Container
