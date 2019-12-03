import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import Browser from './browser/container'
import {NormalPreview} from './filepreview'
import * as Kbfs from './common'
import * as SimpleScreens from './simple-screens'
import {Actions, MainBanner, MobileHeader, useMobileHeaderHeight, Title} from './nav-header'

type ChooseComponentProps = {
  emitBarePreview: () => void
  kbfsDaemonStatus: Types.KbfsDaemonStatus
  path: Types.Path
  pathType: Types.PathType
  waitForKbfsDaemon: () => void
}

const ChooseComponent = (props: ChooseComponentProps) => {
  const {emitBarePreview, waitForKbfsDaemon} = props

  const fileContext = Container.useSelector(
    state => state.fs.fileContext.get(props.path) || Constants.emptyFileContext
  )
  const bare = Container.isMobile && fileContext.viewType === RPCTypes.GUIViewType.image
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
  const onUrlError = Kbfs.useFsFileContext(props.path)
  Kbfs.useFsTlfs()
  Kbfs.useFsOnlineStatus()
  Kbfs.useFsTlf(props.path)
  const softError = Kbfs.useFsSoftError(props.path)

  if (props.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected) {
    return <SimpleScreens.Loading />
  }

  if (softError) {
    return <SimpleScreens.Oops path={props.path} reason={softError} />
  }
  switch (props.pathType) {
    case Types.PathType.Folder:
      return <Browser path={props.path} />
    case Types.PathType.Unknown:
      return <SimpleScreens.Loading />
    default:
      if (fileContext === Constants.emptyFileContext) {
        // We don't have it yet, so don't render.
        return <SimpleScreens.Loading />
      }
      return bare ? (
        // doesn't matter here as we do a navigateAppend for bare views
        <SimpleScreens.Loading />
      ) : (
        <NormalPreview path={props.path} onUrlError={onUrlError} />
      )
  }
}

ChooseComponent.navigationOptions = (ownProps: OwnProps) => {
  const path = Container.getRouteProps(ownProps, 'path', Constants.defaultPath)
  return Container.isMobile
    ? {
        header: (
          <MobileHeader
            path={path}
            onBack={ownProps.navigation.isFirstRouteInParent() ? undefined : ownProps.navigation.pop}
          />
        ),
        useHeaderHeight: () => useMobileHeaderHeight(path),
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
      _pathItem: Constants.getPathItem(state.fs.pathItems, path),
      kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    }
  },
  (dispatch, ownProps) => ({
    emitBarePreview: () => {
      const path = Container.getRouteProps(ownProps, 'path', Constants.defaultPath)
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
      emitBarePreview: dispatchProps.emitBarePreview,
      kbfsDaemonStatus: stateProps.kbfsDaemonStatus,
      path,
      pathType: isDefinitelyFolder ? Types.PathType.Folder : stateProps._pathItem.type,
      waitForKbfsDaemon: dispatchProps.waitForKbfsDaemon,
    }
  },
  'FsMain'
)(ChooseComponent)

export default Connected
