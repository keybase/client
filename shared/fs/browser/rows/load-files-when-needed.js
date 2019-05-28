// @flow
import * as React from 'react'
import {namedConnect} from '../../../util/container'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'

type OwnProps = {|
  path: Types.Path,
  destinationPickerIndex?: number,
|}

const mapStateToProps = state => ({
  syncingFoldersProgress: state.fs.syncingFoldersProgress,
})

const mapDispatchToProps = (dispatch, {path, destinationPickerIndex}) => ({
  loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
  loadFolderListWithRefreshTag: () =>
    dispatch(
      FsGen.createFolderListLoad({
        path,
        refreshTag: typeof destinationPickerIndex === 'number' ? 'destination-picker' : 'main',
      })
    ),
  loadFolderListWithoutRefreshTag: () =>
    dispatch(
      FsGen.createFolderListLoad({
        path,
      })
    ),
})

const mergeProps = (s, d, {path}) => ({
  ...s,
  ...d,
  path,
})

type Props = {|
  loadFolderListWithRefreshTag: () => void,
  loadFolderListWithoutRefreshTag: () => void,
  loadFavorites: () => void,
  path: Types.Path,
  syncingFoldersProgress: Types.SyncingFoldersProgress,
|}

class LoadFilesWhenNeeded extends React.PureComponent<Props> {
  _load = withRefreshTag => {
    const pathLevel = Types.getPathLevel(this.props.path)
    if (pathLevel < 2) {
      return
    }
    pathLevel > 2
      ? withRefreshTag
        ? this.props.loadFolderListWithRefreshTag()
        : this.props.loadFolderListWithoutRefreshTag()
      : this.props.loadFavorites()
  }
  componentDidMount() {
    this._load(true)
  }
  componentDidUpdate(prevProps) {
    if (this.props.path !== prevProps.path) {
      // This gets called on route changes too, e.g. when user clicks the
      // action menu. So only load folder list when path changes.
      this._load(true)
    } else if (this.props.syncingFoldersProgress !== prevProps.syncingFoldersProgress) {
      // If syncingFoldersProgress (i.e. the overall syncing progress) changes,
      // refresh current one so we get updated prefetchStatus in case they
      // change.
      //
      // We omit the refreshTag here because notifications don't get triggered
      // for prefetchStatus changes and it take a few points to do that. If
      // this turns out to cause performance issues, we can figure that out as
      // an optimization.
      this._load(false)
    }
  }
  render() {
    return null
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'LoadFilesWhenNeeded'
)(LoadFilesWhenNeeded)
