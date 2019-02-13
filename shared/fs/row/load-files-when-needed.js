// @flow
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

type OwnProps = {|
  path: Types.Path,
  destinationPickerIndex?: number,
|}

const mapDispatchToProps = (dispatch, {path, destinationPickerIndex}) => ({
  loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
  loadFolderList: () =>
    dispatch(
      FsGen.createFolderListLoad({
        path,
        refreshTag: typeof destinationPickerIndex === 'number' ? 'destination-picker' : 'main',
      })
    ),
})

const mergeProps = (stateProps, {loadFolderList, loadFavorites}, {path}) => ({
  loadFavorites,
  loadFolderList,
  path,
})

type Props = {|
  loadFolderList: () => void,
  loadFavorites: () => void,
  path: Types.Path,
|}

class LoadFilesWhenNeeded extends React.PureComponent<Props> {
  _load = () => {
    const pathLevel = Types.getPathLevel(this.props.path)
    if (pathLevel < 2) {
      return
    }
    pathLevel === 2 ? this.props.loadFavorites() : this.props.loadFolderList()
  }
  componentDidMount() {
    this._load()
  }
  componentDidUpdate(prevProps) {
    // This gets called on route changes too, e.g. when user clicks the
    // action menu. So only load folder list when path changes.
    this.props.path !== prevProps.path && this._load()
  }
  render() {
    return null
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  mergeProps,
  'LoadFilesWhenNeeded'
)(LoadFilesWhenNeeded)
