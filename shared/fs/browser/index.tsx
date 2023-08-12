import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import ConflictBanner from '../banner/conflict-banner-container'
import Footer from '../footer/footer'
import OfflineFolder from './offline'
import PublicReminder from '../banner/public-reminder'
import Root from './root'
import Rows from './rows/rows-container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner/container'
import {isMobile} from '../../constants/platform'

type OwnProps = {path: Types.Path}

export default (ownProps: OwnProps) => {
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
  path: Types.Path
  resetBannerType: Types.ResetBannerType
  writable: boolean
}

const SelfReset = (_: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexGrow}>
    <Kb.Banner color="red">
      <Kb.BannerParagraph
        bannerColor="red"
        content="Since you reset your account, participants have to accept to let you back in."
      />
    </Kb.Banner>
    <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow} centerChildren={true}>
      <Kb.Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Kb.Box2>
  </Kb.Box2>
)

const DragAndDrop = ({
  children,
  path,
  rejectReason,
}: {
  children: React.ReactNode
  path: Types.Path
  rejectReason?: string
}) => {
  const uploadFromDragAndDrop = C.useFSState(s => s.dispatch.dynamic.uploadFromDragAndDropDesktop)
  const onAttach = (localPaths: Array<string>) => uploadFromDragAndDrop?.(path, localPaths)
  return (
    <Kb.DragAndDrop
      allowFolders={true}
      fullWidth={true}
      containerStyle={Styles.globalStyles.flexOne}
      onAttach={!rejectReason ? onAttach : undefined}
      rejectReason={rejectReason}
    >
      {children}
    </Kb.DragAndDrop>
  )
}

const BrowserContent = (props: Props) => {
  const parsedPath = Constants.parsePath(props.path)
  if (parsedPath.kind === Types.PathKind.Root) {
    return (
      <DragAndDrop path={props.path} rejectReason="You can only drop files inside a folder.">
        <Root />
      </DragAndDrop>
    )
  }
  if (parsedPath.kind === Types.PathKind.TlfList) {
    return (
      <DragAndDrop path={props.path} rejectReason="You can only drop files inside a folder.">
        <Rows path={props.path} />
      </DragAndDrop>
    )
  }
  if (props.resetBannerType === Types.ResetBannerNoOthersType.Self) {
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
      <Rows path={props.path} headerRows={[...resetBannerAsRows(props.path, props.resetBannerType)]} />
    </DragAndDrop>
  )
}
