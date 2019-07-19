import * as React from 'react'
import * as I from 'immutable'
import {getRouteProps, namedConnect, RouteProps} from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import {isMobile} from '../constants/platform'
import Browser from './browser/container'
import {NormalPreview} from './filepreview'
import {useFsLoadEffect} from './common'
import * as SimpleScreens from './simple-screens'
import {Actions, MainBanner, MobileHeader, mobileHeaderHeight, Title} from './nav-header'

const mapStateToProps = (state, ownProps: OwnProps) => {
  const path = getRouteProps(ownProps, 'path') || Constants.defaultPath
  return {
    _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
    _softErrors: state.fs.softErrors,
    kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  }
}

const mapDispatchToProps = dispatch => ({
  _emitBarePreview: (path: Types.Path) => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {path}, selected: 'barePreview'}],
      })
    )
  },
  waitForKbfsDaemon: () => dispatch(FsGen.createWaitForKbfsDaemon()),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const path = getRouteProps(ownProps, 'path') || Constants.defaultPath
  const isDefinitelyFolder = Types.getPathElements(path).length <= 3 && !Constants.hasSpecialFileElement(path)
  return {
    emitBarePreview: () => dispatchProps._emitBarePreview(path),
    kbfsDaemonStatus: stateProps.kbfsDaemonStatus,
    mimeType:
      !isDefinitelyFolder && stateProps._pathItem.type === Types.PathType.File
        ? stateProps._pathItem.mimeType
        : null,
    path,
    pathType: isDefinitelyFolder ? Types.PathType.Folder : stateProps._pathItem.type,
    routePath: I.List(), // not a valid value anymore TODO fix
    softError: Constants.getSoftError(stateProps._softErrors, path),
    waitForKbfsDaemon: dispatchProps.waitForKbfsDaemon,
  }
}

type ChooseComponentProps = {
  emitBarePreview: () => void
  kbfsDaemonStatus: Types.KbfsDaemonStatus
  mimeType: Types.Mime | null
  path: Types.Path
  pathType: Types.PathType
  routePath: I.List<string>
  softError: Types.SoftError | null
  waitForKbfsDaemon: () => void
}

const useBare = isMobile
  ? (mimeType: Types.Mime | null) => {
      return Constants.viewTypeFromMimeType(mimeType) === Types.FileViewType.Image
    }
  : () => {
      return false
    }

const ChooseComponent = (props: ChooseComponentProps) => {
  const {emitBarePreview, waitForKbfsDaemon} = props

  const bare = useBare(props.mimeType)
  React.useEffect(() => {
    bare && emitBarePreview()
  }, [bare, emitBarePreview])

  const isConnected = props.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected
  React.useEffect(() => {
    // Always triggers whenever something changes if we are not connected.
    // Saga deduplicates redundant checks.
    isConnected && waitForKbfsDaemon()
  }, [isConnected, waitForKbfsDaemon])

  useFsLoadEffect({
    path: props.path,
    refreshTag: Types.RefreshTag.Main,
    wantPathMetadata: true,
    wantTlfs: true,
  })

  if (props.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected) {
    return <SimpleScreens.Loading />
  }

  if (props.softError) {
    return <SimpleScreens.Oops path={props.path} reason={props.softError} />
  }
  switch (props.pathType) {
    case Types.PathType.Folder:
      return <Browser path={props.path} routePath={props.routePath} />
    case Types.PathType.Unknown:
      return <SimpleScreens.Loading />
    default:
      if (!props.mimeType) {
        // We don't have it yet, so don't render.
        return <SimpleScreens.Loading />
      }
      return bare ? (
        // doesn't matter here as we do a navigateAppend for bare views
        <SimpleScreens.Loading />
      ) : (
        <NormalPreview path={props.path} routePath={props.routePath} />
      )
  }
}

type OwnProps = RouteProps<{path: Types.Path}>

const Connected = namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'FsMain')(ChooseComponent)

// @ts-ignore
Connected.navigationOptions = ({navigation}: {navigation: any}) => {
  const path = navigation.getParam('path') || Constants.defaultPath
  return isMobile
    ? path === Constants.defaultPath
      ? {
          header: undefined,
          title: 'Files',
        }
      : {
          header: (
            <MobileHeader path={path} onBack={navigation.isFirstRouteInParent() ? null : navigation.pop} />
          ),
          headerHeight: mobileHeaderHeight(path),
        }
    : {
        header: undefined,
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === Constants.defaultPath ? 'Files' : Types.getPathName(path),
      }
}

export default Connected
