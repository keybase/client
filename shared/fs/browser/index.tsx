import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import type * as React from 'react'
import * as T from '@/constants/types'
import ConflictBanner from '../banner/conflict-banner'
import Footer from '../footer/footer'
import OfflineFolder from './offline'
import PublicReminder from '../banner/public-reminder'
import Root from './root'
import Rows from './rows/rows-container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner'
import {useModalHeaderState} from '@/stores/modal-header'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  lastClosedPublicBannerTlf?: string
  path: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const filter = useModalHeaderState(s => s.folderViewFilter)
  const {_kbfsDaemonStatus, _pathItem, resetBannerType} = useFSState(
    C.useShallow(s => ({
      _kbfsDaemonStatus: s.kbfsDaemonStatus,
      _pathItem: FS.getPathItem(s.pathItems, path),
      resetBannerType: FS.resetBannerType(s, path),
    }))
  )
  const props = {
    filter,
    lastClosedPublicBannerTlf: ownProps.lastClosedPublicBannerTlf,
    offlineUnsynced: FS.isOfflineUnsynced(_kbfsDaemonStatus, _pathItem, path),
    path,
    resetBannerType,
    writable: _pathItem.writable,
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={{flexGrow: 1}}>
      <Kb.KeyboardAvoidingView2>
        <Kbfs.Errs />
        <BrowserContent {...props} />
        <Footer path={props.path} />
      </Kb.KeyboardAvoidingView2>
    </Kb.Box2>
  )
}

type Props = {
  filter?: string
  lastClosedPublicBannerTlf?: string
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
      <Kb.ImageIcon type={C.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Kb.Box2>
  </Kb.Box2>
)

function DragAndDrop(p: {
  children: React.ReactNode
  path: T.FS.Path
  rejectReason?: string
}) {
  const {children, path, rejectReason} = p
  const uploadFromDragAndDrop = useFSState(s => s.dispatch.uploadFromDragAndDropDesktop)
  const onAttach = (localPaths: Array<string>) => uploadFromDragAndDrop(path, localPaths)
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
}

function BrowserContent(props: Props) {
  const parsedPath = FS.parsePath(props.path)
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
        <Rows filter={props.filter} path={props.path} />
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
      <PublicReminder path={props.path} lastClosedTlf={props.lastClosedPublicBannerTlf} />
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
      <Rows filter={props.filter} path={props.path} headerRows={resetBannerAsRows(props.path, props.resetBannerType)} />
    </DragAndDrop>
  )
}

export default Container
