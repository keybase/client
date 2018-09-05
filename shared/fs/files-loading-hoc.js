// @flow
import * as I from 'immutable'
import * as React from 'react'
import {compose, connect, type TypedState} from '../util/container'
import * as FsGen from '../actions/fs-gen'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

const mapStateToProps = (state: TypedState) => ({
  syncingPaths: state.fs.uploads.syncingPaths,
})

const mapDispatchToProps = (dispatch, {routeProps}) => {
  const path = routeProps.get('path', Constants.defaultPath)
  return {
    loadFolderList: () => dispatch(FsGen.createFolderListLoad({path, refreshTag: 'main'})),
    loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
  }
}

const mergeProps = ({syncingPaths}, {loadFolderList, loadFavorites}, {routeProps, routePath}) => {
  const path = routeProps.get('path', Constants.defaultPath)
  return {
    syncingPaths,
    loadFolderList,
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
    _load = () => {
      const pathLevel = Types.getPathLevel(this.props.path)
      if (pathLevel < 2) {
        return
      }
      pathLevel === 2 && this.props.loadFavorites()
      // This is needed not only inside in a tlf, but also in tlf list, to get
      // `writable` for tlf root.
      this.props.loadFolderList()
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

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), FilesLoadingHoc)
