// @flow
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as React from 'react'
import flags from '../../util/feature-flags'

type Props = {|
  onClick: () => void,
  path: Types.Path,
  pathItem: Types.PathItem,
  style?: ?Styles.StylesCrossPlatform,
|}

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

type OwnProps = {|
  onClick: () => void,
  path: Types.Path,
  style?: ?Styles.StylesCrossPlatform,
|}

const mapStateToProps = (state, {path}) => ({
  pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})
const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d, o) => ({
  onClick: o.onClick,
  path: o.path,
  pathItem: s.pathItem,
  style: o.style,
})

export default (!flags.folderViewFilter
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps,
      'FolderViewFilterIcon'
    )(FolderViewFilterIcon))
