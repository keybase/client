// @flow
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'
import {debounce} from 'lodash-es'
import flags from '../../util/feature-flags'

type Props = {|
  onBlur?: ?() => void,
  onUpdate: string => void,
  path: Types.Path,
  pathItem: Types.PathItem,
  style?: ?Styles.StylesCrossPlatform,
|}

const FolderViewFilter = (props: Props) =>
  Constants.isFolder(props.path, props.pathItem) &&
  Types.getPathLevel(props.path) > 1 && (
    <Kb.SearchFilter
      focusOnMount={Styles.isMobile}
      hotkey="f"
      onBlur={props.onBlur}
      onChange={props.onUpdate}
      placeholderText="Filter"
      style={props.style}
    />
  )

type OwnProps = {|
  onBlur?: ?() => void,
  path: Types.Path,
  style?: ?Styles.StylesCrossPlatform,
|}

const mapStateToProps = (state, {path}) => ({
  pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})
const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _onUpdate: (newFilter: string) => dispatch(FsGen.createSetFolderViewFilter({filter: newFilter})),
})

const mergeProps = (s, d, o) => ({
  onBlur: o.onBlur,
  onUpdate: debounce(d._onUpdate, 100),
  path: o.path,
  pathItem: s.pathItem,
  style: o.style,
})

export default (!flags.folderViewFilter
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FolderViewFilter')(
      FolderViewFilter
    ))
