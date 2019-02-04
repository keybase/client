// @flow
import * as React from 'react'
import * as I from 'immutable'
import {namedConnect, type RouteProps} from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import {isMobile} from '../constants/platform'
import Folder from './folder/container'
import {NormalPreview} from './filepreview'
import Loading from './common/loading'

const mapStateToProps = state => ({
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = (dispatch, {routePath}) => ({
  _emitBarePreview: (path: Types.Path) =>
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: routePath,
        otherAction: RouteTreeGen.createNavigateTo({
          parentPath: routePath.skipLast(1),
          path: [{props: {path}, selected: 'barePreview'}],
        }),
      })
    ),
  _loadPathMetadata: (path: Types.Path) => dispatch(FsGen.createLoadPathMetadata({path})),
})

const mergeProps = (stateProps, dispatchProps, {routeProps, routePath}) => {
  const path = routeProps.get('path', Constants.defaultPath)
  const isDefinitelyFolder = Types.getPathElements(path).length <= 3
  const pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  return {
    emitBarePreview: () => dispatchProps._emitBarePreview(path),
    loadPathMetadata: () => dispatchProps._loadPathMetadata(path),
    mimeType: !isDefinitelyFolder && pathItem.type === 'file' ? pathItem.mimeType : null,
    path,
    pathType: isDefinitelyFolder ? 'folder' : stateProps._pathItems.get(path, Constants.unknownPathItem).type,
    routePath,
  }
}

type ChooseComponentProps = {
  emitBarePreview: () => void,
  loadPathMetadata: () => void,
  mimeType: ?Types.Mime,
  path: Types.Path,
  pathType: Types.PathType,
  routePath: I.List<string>,
}

const useBare = isMobile
  ? (mimeType: ?Types.Mime) => {
      return Constants.viewTypeFromMimeType(mimeType) === 'image'
    }
  : (mimeType: ?Types.Mime) => {
      return false
    }

class ChooseComponent extends React.PureComponent<ChooseComponentProps> {
  componentDidMount() {
    if (useBare(this.props.mimeType)) {
      this.props.emitBarePreview()
    }
    this.props.loadPathMetadata()
  }
  componentDidUpdate(prevProps) {
    if (this.props.mimeType !== prevProps.mimeType && useBare(this.props.mimeType)) {
      this.props.emitBarePreview()
    }
    if (this.props.path !== prevProps.path) {
      this.props.loadPathMetadata()
    }
  }
  render() {
    switch (this.props.pathType) {
      case 'folder':
        return <Folder path={this.props.path} routePath={this.props.routePath} />
      case 'unknown':
        return <Loading path={this.props.path} />
      default:
        if (!this.props.mimeType) {
          // We don't have it yet, so don't render.
          return <Loading path={this.props.path} />
        }
        return useBare(this.props.mimeType) ? (
          // doesn't matter here as we do a navigateAppend for bare views
          <Loading path={this.props.path} />
        ) : (
          <NormalPreview path={this.props.path} routePath={this.props.routePath} />
        )
    }
  }
}

type OwnProps = RouteProps<{|path: Types.Path|}, {||}>

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FsMain')(
  ChooseComponent
)
