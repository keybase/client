import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as React from 'react'

type Props = {
  onClick: () => void
  path: Types.Path
  pathItem: Types.PathItem
  style?: Styles.StylesCrossPlatform | null
}

export const FolderViewFilterIcon = (props: Props) =>
  Constants.isFolder(props.path, props.pathItem) && Types.getPathLevel(props.path) > 1 ? (
    <Kb.Icon
      type="iconfont-filter"
      onClick={props.onClick}
      padding="tiny"
      style={props.style && Kb.iconCastPlatformStyles(props.style)}
    />
  ) : null

type OwnProps = Omit<Props, 'pathItem'>

export default namedConnect(
  (state, {path}: OwnProps) => ({
    pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  }),
  () => ({}),
  (s, _, o: OwnProps) => ({
    ...o,
    pathItem: s.pathItem,
  }),
  'FolderViewFilterIcon'
)(FolderViewFilterIcon)
