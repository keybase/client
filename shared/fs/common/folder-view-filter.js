// @flow
import {namedConnect} from '../../util/container'
import * as Platforms from '../../constants/platform'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'
import {debounce} from 'lodash-es'
import flags from '../../util/feature-flags'

type Props = {|
  onUpdate: string => void,
  path: Types.Path,
  style?: ?Styles.StylesCrossPlatform,
|}

const FolderViewFilter = (props: Props) =>
  Types.getPathLevel(props.path) > 1 && (
    <Kb.SearchFilter
      hotkey="f"
      icon="iconfont-filter"
      onChange={props.onUpdate}
      placeholderText="Filter"
      type="Small"
      style={props.style}
    />
  )

type OwnProps = {|
  path: Types.Path,
  style?: ?Styles.StylesCrossPlatform,
|}

const mapStateToProps = state => ({})
const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _onUpdate: (newFilter: string) => dispatch(FsGen.createSetFolderViewFilter({filter: newFilter})),
})

const mergeProps = (s, d, o) => ({
  onUpdate: debounce(d._onUpdate, 100),
  path: o.path,
  style: o.style,
})

export default (Platforms.isMobile || !flags.folderViewFilter
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FolderViewFilter')(
      FolderViewFilter
    ))
