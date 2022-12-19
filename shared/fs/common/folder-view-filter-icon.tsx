import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import type * as Styles from '../../styles'

type Props = {
  onClick: () => void
  path: Types.Path
  pathItem: Types.PathItem
  style?: Styles.StylesCrossPlatform | null
}

export const FolderViewFilterIcon = (props: Props) =>
  Constants.isFolder(props.path, props.pathItem) && Types.getPathLevel(props.path) > 1 ? (
    <Kb.Icon type="iconfont-filter" onClick={props.onClick} padding="tiny" style={props.style} />
  ) : null

type OwnProps = Omit<Props, 'pathItem'>

export default Container.connect(
  (state, {path}: OwnProps) => ({
    pathItem: Constants.getPathItem(state.fs.pathItems, path),
  }),
  () => ({}),
  (s, _, o: OwnProps) => ({
    ...o,
    pathItem: s.pathItem,
  })
)(FolderViewFilterIcon)
