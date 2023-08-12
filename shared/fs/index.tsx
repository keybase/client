import * as C from '../constants'
import * as React from 'react'
import * as Constants from '../constants/fs'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/fs'
import Browser from './browser'
import {NormalPreview} from './filepreview'
import * as Kbfs from './common'
import * as SimpleScreens from './simple-screens'

type ChooseComponentProps = {
  emitBarePreview: () => void
  kbfsDaemonStatus: Types.KbfsDaemonStatus
  path: Types.Path
  pathType: Types.PathType
}

const ChooseComponent = (props: ChooseComponentProps) => {
  const {emitBarePreview} = props

  const fileContext = C.useFSState(s => s.fileContext.get(props.path) || Constants.emptyFileContext)
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

type OwnProps = {path?: Types.Path}

const Connected = (ownProps?: OwnProps) => {
  const path = ownProps?.path ?? C.defaultPath
  const _pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const emitBarePreview = () => {
    navigateUp()
    navigateAppend({props: {path}, selected: 'barePreview'})
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
