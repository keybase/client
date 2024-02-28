import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as Styles from '@/styles'

type Props = {
  onClick: () => void
  path: T.FS.Path
  pathItem: T.FS.PathItem
  style?: Styles.StylesCrossPlatform
}

const FolderViewFilterIcon = (props: Props) =>
  C.FS.isFolder(props.path, props.pathItem) && T.FS.getPathLevel(props.path) > 1 ? (
    <Kb.Icon type="iconfont-filter" onClick={props.onClick} padding="tiny" style={props.style} />
  ) : null

type OwnProps = Omit<Props, 'pathItem'>

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = C.useFSState(s => C.FS.getPathItem(s.pathItems, path))
  const props = {
    ...ownProps,
    pathItem,
  }
  return <FolderViewFilterIcon {...props} />
}

export default Container
