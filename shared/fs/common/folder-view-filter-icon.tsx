import * as Types from '../../constants/types/fs'
import * as C from '../../constants'
import * as Kb from '../../common-adapters'
import type * as Styles from '../../styles'

type Props = {
  onClick: () => void
  path: Types.Path
  pathItem: Types.PathItem
  style?: Styles.StylesCrossPlatform
}

export const FolderViewFilterIcon = (props: Props) =>
  C.isFolder(props.path, props.pathItem) && Types.getPathLevel(props.path) > 1 ? (
    <Kb.Icon type="iconfont-filter" onClick={props.onClick} padding="tiny" style={props.style} />
  ) : null

type OwnProps = Omit<Props, 'pathItem'>

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const props = {
    ...ownProps,
    pathItem,
  }
  return <FolderViewFilterIcon {...props} />
}
