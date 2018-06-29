// @flow
import * as I from 'immutable'
import * as React from 'react'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../util/container'
import * as FsGen from '../actions/fs-gen'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

const mapStateToProps = (state: TypedState) => ({
  syncingPaths: state.fs.uploads.syncingPaths,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
  loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
})

const mergeProps = ({syncingPaths}, {_loadFolderList, loadFavorites}, {routeProps, routePath}) => {
  const path = routeProps.get('path', Constants.defaultPath)
  return {
    syncingPaths,
    loadFolderList: () => _loadFolderList(path),
    loadFavorites,
    path,
    routePath,
  }
}

type FilesLoadingHocProps = {
  syncingPaths: I.Set<Types.Path>,
  loadFolderList: () => void,
  loadFavorites: () => void,
  path: Types.Path,
  routePath: Array<string>,
}

const FilesLoadingHoc = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<FilesLoadingHocProps> {
    componentDidMount() {
      this.props.loadFolderList()
      this.props.loadFavorites()
    }
    componentDidUpdate(prevProps) {
      // This gets called on route changes too, e.g. when user clicks the
      // action menu. So only load folder list when path changes.
      const pathLevel = Types.getPathLevel(this.props.path)
      pathLevel === 2 && this.props.loadFavorites()

      const childrenMayHaveChanged = this.props.syncingPaths.has(this.props.path)
      if (this.props.path !== prevProps.path || childrenMayHaveChanged) {
        this.props.loadFolderList()
      }
    }
    render() {
      return <ComposedComponent {...this.props} />
    }
  }

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FilesLoadingHoc'),
  FilesLoadingHoc
)
