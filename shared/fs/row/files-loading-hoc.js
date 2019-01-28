// @flow
import * as I from 'immutable'
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

type OwnProps = {
  path: Types.Path,
  destinationPickerIndex?: number,
}

const mapStateToProps = state => ({
  syncingPaths: state.fs.uploads.syncingPaths,
})

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

const mergeProps = ({syncingPaths}, {loadFolderList, loadFavorites}, o) => ({
  loadFavorites,
  loadFolderList,
  syncingPaths,
  // $FlowFixMe it's a HOC so we need to pass through inexact properties.
  ...o,
})

type FilesLoadingHocProps = {
  syncingPaths: I.Set<Types.Path>,
  loadFolderList: () => void,
  loadFavorites: () => void,
  path: Types.Path,
}

const FilesLoadingHoc = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<FilesLoadingHocProps> {
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
      return <ComposedComponent {...this.props} />
    }
  }

export default (ComposedComponent: React.ComponentType<any>) =>
  namedConnect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    'ConnectedFilesLoadingHoc'
  )(FilesLoadingHoc(ComposedComponent))
