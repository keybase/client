import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'
import {debounce} from 'lodash-es'

type Props = {
  onCancel?: (() => void)| null
  onUpdate: (arg0: string) => void
  path: Types.Path
  pathItem: Types.PathItem
  style?: Styles.StylesCrossPlatform | null
}

class FolderViewFilter extends React.PureComponent<Props> {
  _clear() {
    this.props.onUpdate('')
  }
  componentWillUnmount() {
    this._clear()
  }
  componentDidUpdate(prevProps: Props) {
    prevProps.path !== this.props.path && this._clear()
  }
  render() {
    return (
      Constants.isFolder(this.props.path, this.props.pathItem) &&
      Types.getPathLevel(this.props.path) > 1 && (
        <Kb.SearchFilter
          focusOnMount={Styles.isMobile}
          hotkey="f"
          onCancel={this.props.onCancel}
          onChange={this.props.onUpdate}
          placeholderText="Filter"
          style={this.props.style}
        />
      )
    )
  }
}

type OwnProps = Omit<Omit<Props, 'onUpdate'>, 'pathItem'>

export default namedConnect(
  (state, {path}: OwnProps) => ({
    pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  }),
  dispatch => ({
    _onUpdate: (newFilter: string) => dispatch(FsGen.createSetFolderViewFilter({filter: newFilter})),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    onUpdate: debounce(d._onUpdate, 100),
    pathItem: s.pathItem,
  }),
  'FolderViewFilter'
)(FolderViewFilter)
