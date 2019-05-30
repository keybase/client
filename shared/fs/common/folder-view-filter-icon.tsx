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
  Constants.isFolder(props.path, props.pathItem) &&
  Types.getPathLevel(props.path) > 1 && (
    <Kb.Icon
      type="iconfont-filter"
      onClick={props.onClick}
      padding="tiny"
      style={props.style && Kb.iconCastPlatformStyles(props.style)}
    />
  )

type OwnProps = Exclude<
  Props,
  {
    pathItem: Types.PathItem
  }
>

const mapStateToProps = (state, {path}) => ({
  pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})
const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d, o) => ({
  ...o,
  pathItem: s.pathItem,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'FolderViewFilterIcon')(
  FolderViewFilterIcon
)
