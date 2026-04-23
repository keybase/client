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
  lastClosedPublicBannerTlf?: string
  path: T.FS.Path
  pathType: T.FS.PathType
}

const ChooseComponent = (props: ChooseComponentProps) => {
  const {emitBarePreview} = props

  const {fileContext, onUrlError} = Kbfs.useFsFileContext(props.path)
  const bare = C.isMobile && fileContext.viewType === T.RPCGen.GUIViewType.image
  React.useEffect(() => {
    bare && emitBarePreview()
  }, [bare, emitBarePreview])

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
      return <Browser lastClosedPublicBannerTlf={props.lastClosedPublicBannerTlf} path={props.path} />
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

type OwnProps = {
  lastClosedPublicBannerTlf?: string
  path?: T.FS.Path
}

const ConnectedInner = (ownProps: OwnProps) => {
  const path = ownProps.path ?? FS.defaultPath
  const _pathItem = Kbfs.useFsPathItem(path)
  const kbfsDaemonStatus = useFSState(s => s.kbfsDaemonStatus)
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  const emitBarePreview = () => {
    navigateUp()
    navigateAppend({name: 'barePreview', params: {path}})
  }
  const isDefinitelyFolder = T.FS.getPathElements(path).length <= 3 && !FS.hasSpecialFileElement(path)
  const props = {
    emitBarePreview: emitBarePreview,
    kbfsDaemonStatus: kbfsDaemonStatus,
    lastClosedPublicBannerTlf: ownProps.lastClosedPublicBannerTlf,
    path,
    pathType: isDefinitelyFolder ? T.FS.PathType.Folder : _pathItem.type,
  }
  return (
    <ChooseComponent {...props} />
  )
}

const Connected = (ownProps: OwnProps) => (
  <Kbfs.FsDataProvider>
    <ConnectedInner {...ownProps} />
  </Kbfs.FsDataProvider>
)

export default Connected
