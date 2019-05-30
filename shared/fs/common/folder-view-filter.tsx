import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'
import {debounce} from 'lodash-es'

type Props = {
  onCancel?: () => void | null
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
  componentDidUpdate(prevProps) {
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

type OwnProps = Exclude<
  Props,
  {
    onUpdate: (arg0: string) => void
    pathItem: Types.PathItem
  }
>

const mapStateToProps = (state, {path}) => ({
  pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})
const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _onUpdate: (newFilter: string) => dispatch(FsGen.createSetFolderViewFilter({filter: newFilter})),
})

const mergeProps = (s, d, o) => ({
  ...o,
  onUpdate: debounce(d._onUpdate, 100),
  pathItem: s.pathItem,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'FolderViewFilter')(
  FolderViewFilter
)
