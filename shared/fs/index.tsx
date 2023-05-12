import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'
import Browser from './browser'
import {NormalPreview} from './filepreview'
import * as Kbfs from './common'
import * as SimpleScreens from './simple-screens'
import {Actions, MainBanner, MobileHeader, Title} from './nav-header'

type ChooseComponentProps = {
  emitBarePreview: () => void
  kbfsDaemonStatus: Types.KbfsDaemonStatus
  path: Types.Path
  pathType: Types.PathType
}

const ChooseComponent = (props: ChooseComponentProps) => {
  const {emitBarePreview} = props

  const fileContext = Container.useSelector(
    state => state.fs.fileContext.get(props.path) || Constants.emptyFileContext
  )
  const bare = Container.isMobile && fileContext.viewType === RPCTypes.GUIViewType.image
  React.useEffect(() => {
    bare && emitBarePreview()
  }, [bare, emitBarePreview])

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

export const getOptions = (ownProps: OwnProps) => {
  const path = ownProps.route.params?.path ?? Constants.defaultPath
  return Container.isMobile
    ? {
        header: () => <MobileHeader path={path} onBack={ownProps.navigation.pop} />,
      }
    : {
        headerRightActions: () => <Actions path={path} onTriggerFilterMobile={() => {}} />,
        headerTitle: () => <Title path={path} />,
        subHeader: MainBanner,
        title: path === Constants.defaultPath ? 'Files' : Types.getPathName(path),
      }
}

type OwnProps = Container.RouteProps2<'fsRoot'>

const Connected = (ownProps: OwnProps) => {
  const path = ownProps.route.params?.path ?? Constants.defaultPath
  const _pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const kbfsDaemonStatus = Container.useSelector(state => state.fs.kbfsDaemonStatus)

  const dispatch = Container.useDispatch()
  const emitBarePreview = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {path}, selected: 'barePreview'}],
      })
    )
  }
  const isDefinitelyFolder = Types.getPathElements(path).length <= 3 && !Constants.hasSpecialFileElement(path)
  const props = {
    emitBarePreview: emitBarePreview,
    kbfsDaemonStatus: kbfsDaemonStatus,
    path,
    pathType: isDefinitelyFolder ? Types.PathType.Folder : _pathItem.type,
  }
  return <ChooseComponent {...props} />
}

export default Connected
