// @flow
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

const setRefreshTag = true
const doNotSetRefreshTag = false

type OwnProps = {|
  path: Types.Path,
  destinationPickerIndex?: number,
|}

const mapStateToProps = state => ({
  syncingFoldersProgress: state.fs.syncingFoldersProgress,
})

const mapDispatchToProps = (dispatch, {path, destinationPickerIndex}) => ({
  loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
  loadFolderList: () =>
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
  loadFolderList: (setRefreshTag: boolean) => void,
  loadFavorites: () => void,
  path: Types.Path,
  syncingFoldersProgress: Types.SyncingFoldersProgress,
|}

class LoadFilesWhenNeeded extends React.PureComponent<Props> {
  _load = setRefreshTag => {
    const pathLevel = Types.getPathLevel(this.props.path)
    if (pathLevel < 2) {
      return
    }
    pathLevel === 2 ? this.props.loadFavorites() : this.props.loadFolderList(setRefreshTag)
  }
  componentDidMount() {
    this._load(setRefreshTag)
  }
  componentDidUpdate(prevProps) {
    if (this.props.syncingFoldersProgress !== prevProps.syncingFoldersProgress) {
      // If syncingFoldersProgress (i.e. the overall syncing progress) changes,
      // refresh current one so we get updated prefetchStatus in case they
      // change.
      //
      // We omit the refreshTag here because notifications don't get triggered
      // for prefetchStatus changes and it take a few points to do that. If
      // this turns out to cause performance issues, we can figure that out as
      // an optimization.
      this._load(doNotSetRefreshTag)
    }
    // This gets called on route changes too, e.g. when user clicks the
    // action menu. So only load folder list when path changes.
    this.props.path !== prevProps.path && this._load(setRefreshTag)
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
