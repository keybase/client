import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import Browser from './browser'
import {NormalPreview} from './filepreview'
import * as Kbfs from './common'
import * as SimpleScreens from './simple-screens'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type ChooseComponentProps = {
  emitBarePreview: () => void
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
  path: T.FS.Path
  pathType: T.FS.PathType
}

const ChooseComponent = (props: ChooseComponentProps) => {
  const {emitBarePreview} = props

  const fileContext = useFSState(s => s.fileContext.get(props.path) || FS.emptyFileContext)
  const bare = C.isMobile && fileContext.viewType === T.RPCGen.GUIViewType.image
  React.useEffect(() => {
    bare && emitBarePreview()
  }, [bare, emitBarePreview])

  Kbfs.useFsPathMetadata(props.path)
  const onUrlError = Kbfs.useFsFileContext(props.path)
  Kbfs.useFsTlfs()
  Kbfs.useFsOnlineStatus()
  Kbfs.useFsTlf(props.path)
  const softError = Kbfs.useFsSoftError(props.path)

  if (props.kbfsDaemonStatus.rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
    return <SimpleScreens.Loading why="(Kbfs not running?)" />
  }

  if (softError) {
    return <SimpleScreens.Oops path={props.path} reason={softError} />
  }
  switch (props.pathType) {
    case T.FS.PathType.Folder:
      return <Browser path={props.path} />
    case T.FS.PathType.Unknown:
      return <SimpleScreens.Loading />
    default:
      if (fileContext === FS.emptyFileContext) {
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

type OwnProps = {path?: T.FS.Path}

const Connected = (ownProps: OwnProps) => {
  const path = ownProps.path ?? FS.defaultPath
  const {_pathItem, kbfsDaemonStatus} = useFSState(
    C.useShallow(s => {
      const _pathItem = FS.getPathItem(s.pathItems, path)
      const kbfsDaemonStatus = s.kbfsDaemonStatus
      return {_pathItem, kbfsDaemonStatus}
    })
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const emitBarePreview = () => {
    navigateUp()
    navigateAppend({props: {path}, selected: 'barePreview'})
  }
  const isDefinitelyFolder = T.FS.getPathElements(path).length <= 3 && !FS.hasSpecialFileElement(path)
  const props = {
    emitBarePreview: emitBarePreview,
    kbfsDaemonStatus: kbfsDaemonStatus,
    path,
    pathType: isDefinitelyFolder ? T.FS.PathType.Folder : _pathItem.type,
  }
  return <ChooseComponent {...props} />
}

export default Connected
