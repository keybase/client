import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import * as React from 'react'
import * as T from '@/constants/types'
import ConflictBanner from '../banner/conflict-banner-container'
import Footer from '../footer/footer'
import OfflineFolder from './offline'
import PublicReminder from '../banner/public-reminder'
import Root from './root'
import Rows from './rows/rows-container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner/container'

type OwnProps = {path: T.FS.Path}

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const _pathItem = C.useFSState(s => Constants.getPathItem(s.pathItems, path))
  const resetBannerType = C.useFSState(s => Constants.resetBannerType(s, path))
  const props = {
    offlineUnsynced: Constants.isOfflineUnsynced(_kbfsDaemonStatus, _pathItem, path),
    path,
    resetBannerType,
    writable: _pathItem.writable,
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kbfs.Errs />
      <BrowserContent {...props} />
      <Footer path={props.path} />
    </Kb.Box2>
  )
}

type Props = {
  offlineUnsynced: boolean
  path: T.FS.Path
  resetBannerType: T.FS.ResetBannerType
  writable: boolean
}

const SelfReset = (_: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.globalStyles.flexGrow}>
    <Kb.Banner color="red">
      <Kb.BannerParagraph
        bannerColor="red"
        content="Since you reset your account, participants have to accept to let you back in."
      />
    </Kb.Banner>
    <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexGrow} centerChildren={true}>
      <Kb.Icon type={C.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Kb.Box2>
  </Kb.Box2>
)

const DragAndDrop = React.memo(function DragAndDrop(p: {
  children: React.ReactNode
  path: T.FS.Path
  rejectReason?: string
}) {
  const {children, path, rejectReason} = p
  const uploadFromDragAndDrop = C.useFSState(s => s.dispatch.dynamic.uploadFromDragAndDropDesktop)
  const onAttach = React.useCallback(
    (localPaths: Array<string>) => uploadFromDragAndDrop?.(path, localPaths),
    [path, uploadFromDragAndDrop]
  )
  return (
    <Kb.DragAndDrop
      allowFolders={true}
      fullWidth={true}
      containerStyle={Kb.Styles.globalStyles.flexOne}
      onAttach={!rejectReason ? onAttach : undefined}
      rejectReason={rejectReason}
    >
      {children}
    </Kb.DragAndDrop>
  )
})

const BrowserContent = React.memo(function BrowserContent(props: Props) {
  const parsedPath = Constants.parsePath(props.path)
  if (parsedPath.kind === T.FS.PathKind.Root) {
    return (
      <DragAndDrop path={props.path} rejectReason="You can only drop files inside a folder.">
        <Root />
      </DragAndDrop>
    )
  }
  if (parsedPath.kind === T.FS.PathKind.TlfList) {
    return (
      <DragAndDrop path={props.path} rejectReason="You can only drop files inside a folder.">
        <Rows path={props.path} />
      </DragAndDrop>
    )
  }
  if (props.resetBannerType === T.FS.ResetBannerNoOthersType.Self) {
    return (
      <DragAndDrop path={props.path} rejectReason="You can only drop files after participants let you in.">
        <SelfReset {...props} />
      </DragAndDrop>
    )
  }
  const addCommonStuff = (children: React.ReactNode) => (
    <>
      <PublicReminder path={props.path} />
      <ConflictBanner path={props.path} />
      {children}
    </>
  )
  if (props.offlineUnsynced) {
    return addCommonStuff(
      <DragAndDrop
        path={props.path}
        rejectReason="Drop files in unsynced folder is only supported when you are online."
      >
        <OfflineFolder path={props.path} />
      </DragAndDrop>
    )
  }
  return addCommonStuff(
    <DragAndDrop
      path={props.path}
      rejectReason={props.writable ? undefined : "You don't have write permission in this folder."}
    >
      <Rows path={props.path} headerRows={resetBannerAsRows(props.path, props.resetBannerType)} />
    </DragAndDrop>
  )
})

export default Container
