import * as React from 'react'
import * as T from '@/constants/types'
import Browser from './browser'
import {NormalPreview} from './filepreview'
import * as Kbfs from './common'
import * as SimpleScreens from './simple-screens'
import * as FS from '@/constants/fs'

type ChooseComponentProps = {
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
  lastClosedPublicBannerTlf?: string
  path: T.FS.Path
  pathType: T.FS.PathType
}

const ChooseComponent = (props: ChooseComponentProps) => {
  const {fileContext, onUrlError} = Kbfs.useFsFileContext(props.path)

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
        return <SimpleScreens.Loading />
      }
      return <NormalPreview path={props.path} onUrlError={onUrlError} />
  }
}

type OwnProps = {
  initialLastModifiedTimestamp?: number
  initialPathType?: T.FS.PathType
  lastClosedPublicBannerTlf?: string
  path?: T.FS.Path
}

const ConnectedInner = (ownProps: OwnProps) => {
  const path = ownProps.path ?? FS.defaultPath
  Kbfs.useFsScreenCoordinator(path)
  const _pathItem = Kbfs.useFsPathItem(path)
  const kbfsDaemonStatus = Kbfs.useKbfsDaemonStatus()
  const isDefinitelyFolder = T.FS.getPathElements(path).length <= 3 && !FS.hasSpecialFileElement(path)
  const props = {
    kbfsDaemonStatus,
    lastClosedPublicBannerTlf: ownProps.lastClosedPublicBannerTlf,
    path,
    pathType: isDefinitelyFolder ? T.FS.PathType.Folder : _pathItem.type,
  }
  return <ChooseComponent {...props} />
}

const Connected = (ownProps: OwnProps) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider
      initialLastModifiedTimestamp={ownProps.initialLastModifiedTimestamp}
      initialPath={ownProps.path}
      initialPathType={ownProps.initialPathType}
    >
      <ConnectedInner {...ownProps} />
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

export default Connected
