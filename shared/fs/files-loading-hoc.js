// @flow
import * as I from 'immutable'
import * as React from 'react'
import {compose, connect, type Dispatch, type TypedState} from '../util/container'
import * as FsGen from '../actions/fs-gen'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

const mapStateToProps = (state: TypedState) => ({
  syncingPaths: state.fs.uploads.syncingPaths,
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => {
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
    componentDidMount() {
      this.props.loadFolderList()
      this.props.loadFavorites()
    }
    componentDidUpdate(prevProps) {
      // This gets called on route changes too, e.g. when user clicks the
      // action menu. So only load folder list when path changes.
      if (this.props.path !== prevProps.path) {
        this.props.loadFolderList()
        Types.getPathLevel(this.props.path) === 2 && this.props.loadFavorites()
      }
    }
    render() {
      return <ComposedComponent {...this.props} />
    }
  }

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), FilesLoadingHoc)
