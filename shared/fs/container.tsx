import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import Browser from './browser/container'
import {NormalPreview} from './filepreview'
import * as Kbfs from './common'
import * as SimpleScreens from './simple-screens'
import {Actions, MainBanner, MobileHeader, mobileHeaderHeight, Title} from './nav-header'

type ChooseComponentProps = {
  emitBarePreview: () => void
  kbfsDaemonStatus: Types.KbfsDaemonStatus
  mimeType: Types.Mime | null
  path: Types.Path
  pathType: Types.PathType
  softError: Types.SoftError | null
  waitForKbfsDaemon: () => void
}

const useBare = Container.isMobile
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

  Kbfs.useFsPathMetadata(props.path)
  Kbfs.useFsTlfs()
  Kbfs.useFsOnlineStatus()

  if (props.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected) {
    return <SimpleScreens.Loading />
  }

  if (props.softError) {
    return <SimpleScreens.Oops path={props.path} reason={props.softError} />
  }
  switch (props.pathType) {
    case Types.PathType.Folder:
      return <Browser path={props.path} />
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
        <NormalPreview path={props.path} />
      )
  }
}

ChooseComponent.navigationOptions = (ownProps: OwnProps) => {
  const path = Container.getRouteProps(ownProps, 'path', Constants.defaultPath)
  return Container.isMobile
    ? path === Constants.defaultPath
      ? {
          header: undefined,
          title: 'Files',
        }
      : {
          header: (
            <MobileHeader
              path={path}
              onBack={ownProps.navigation.isFirstRouteInParent() ? undefined : ownProps.navigation.pop}
            />
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

type OwnProps = Container.RouteProps<{path: Types.Path}>

const Connected = Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const path = Container.getRouteProps(ownProps, 'path', Constants.defaultPath)
    return {
      _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
      _softErrors: state.fs.softErrors,
      kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    }
  },
  dispatch => ({
    _emitBarePreview: (path: Types.Path) => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {path}, selected: 'barePreview'}],
        })
      )
    },
    waitForKbfsDaemon: () => dispatch(FsGen.createWaitForKbfsDaemon()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const path = Container.getRouteProps(ownProps, 'path', Constants.defaultPath)
    const isDefinitelyFolder =
      Types.getPathElements(path).length <= 3 && !Constants.hasSpecialFileElement(path)
    return {
      emitBarePreview: () => dispatchProps._emitBarePreview(path),
      kbfsDaemonStatus: stateProps.kbfsDaemonStatus,
      mimeType:
        !isDefinitelyFolder && stateProps._pathItem.type === Types.PathType.File
          ? stateProps._pathItem.mimeType
          : null,
      path,
      pathType: isDefinitelyFolder ? Types.PathType.Folder : stateProps._pathItem.type,
      softError: Constants.getSoftError(stateProps._softErrors, path),
      waitForKbfsDaemon: dispatchProps.waitForKbfsDaemon,
    }
  },
  'FsMain'
)(ChooseComponent)

export default Connected
