// @flow
import * as React from 'react'
import * as I from 'immutable'
import {getRouteProps, namedConnect, type RouteProps} from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import {isMobile} from '../constants/platform'
import Folder from './folder/container'
import {NormalPreview} from './filepreview'
import Loading from './common/loading'
import KbfsDaemonNotRunning from './common/kbfs-daemon-not-running'
import LoadPathMetadataWhenNeeded from './common/load-path-metadata-when-needed'
import {Actions, MobileHeader, Title} from './nav-header'
import flags from '../util/feature-flags'

const mapStateToProps = state => ({
  _pathItems: state.fs.pathItems,
  kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
})

const mapDispatchToProps = (dispatch, {routePath}) => ({
  _emitBarePreview: flags.useNewRouter
    ? (path: Types.Path) => {
        dispatch(RouteTreeGen.createNavigateUp())
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {path}, selected: 'barePreview'}],
          })
        )
      }
    : (path: Types.Path) =>
        dispatch(
          RouteTreeGen.createPutActionIfOnPath({
            expectedPath: routePath,
            otherAction: RouteTreeGen.createNavigateTo({
              parentPath: routePath.skipLast(1),
              path: [{props: {path}, selected: 'barePreview'}],
            }),
          })
        ),
  waitForKbfsDaemon: () => dispatch(FsGen.createWaitForKbfsDaemon()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const path = getRouteProps(ownProps, 'path') || Constants.defaultPath
  const isDefinitelyFolder = Types.getPathElements(path).length <= 3
  const pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  return {
    emitBarePreview: () => dispatchProps._emitBarePreview(path),
    kbfsDaemonStatus: stateProps.kbfsDaemonStatus,
    mimeType: !isDefinitelyFolder && pathItem.type === 'file' ? pathItem.mimeType : null,
    path,
    pathType: isDefinitelyFolder ? 'folder' : stateProps._pathItems.get(path, Constants.unknownPathItem).type,
    routePath: ownProps.routePath,
    waitForKbfsDaemon: dispatchProps.waitForKbfsDaemon,
  }
}

type ChooseComponentProps = {|
  emitBarePreview: () => void,
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  mimeType: ?Types.Mime,
  path: Types.Path,
  pathType: Types.PathType,
  routePath: I.List<string>,
  waitForKbfsDaemon: () => void,
|}

const useBare = isMobile
  ? (mimeType: ?Types.Mime) => {
      return Constants.viewTypeFromMimeType(mimeType) === 'image'
    }
  : (mimeType: ?Types.Mime) => {
      return false
    }

class ChooseComponent extends React.PureComponent<ChooseComponentProps> {
  waitForKbfsDaemonIfNeeded() {
    if (this.props.kbfsDaemonStatus.rpcStatus !== 'connected') {
      // Always triggers whenever something changes if we are not connected.
      // Saga deduplicates redundant checks.
      this.props.waitForKbfsDaemon()
    }
  }
  componentDidMount() {
    if (useBare(this.props.mimeType)) {
      this.props.emitBarePreview()
    }
    this.waitForKbfsDaemonIfNeeded()
  }
  componentDidUpdate(prevProps) {
    if (this.props.mimeType !== prevProps.mimeType && useBare(this.props.mimeType)) {
      this.props.emitBarePreview()
    }
    this.waitForKbfsDaemonIfNeeded()
  }

  getContent() {
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
  render() {
    if (this.props.kbfsDaemonStatus.rpcStatus !== 'connected') {
      return <KbfsDaemonNotRunning />
    }
    return (
      <>
        <LoadPathMetadataWhenNeeded path={this.props.path} refreshTag="main" />
        {this.getContent()}
      </>
    )
  }
}

type OwnProps = RouteProps<{|path: Types.Path|}, {||}>

const Connected = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'FsMain'
)(ChooseComponent)

// $FlowIssue lets fix this
Connected.navigationOptions = ({navigation}: {navigation: any}) => {
  const path = navigation.getParam('path') || Constants.defaultPath
  return isMobile
    ? {
        header: <MobileHeader path={path} onBack={navigation.pop} />,
      }
    : {
        header: undefined,
        headerRightActions: () => <Actions path={path} />,
        headerTitle: () => <Title path={path} />,
        title: path === Constants.defaultPath ? 'Files' : Types.getPathName(path),
      }
}

export default Connected
