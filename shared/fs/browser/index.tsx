import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'
import Footer from '../footer/footer'
import {isMobile} from '../../constants/platform'
import Rows from './rows/rows-container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner/container'
import ConflictBanner from '../banner/conflict-banner-container'
import OfflineFolder from './offline'
import PublicReminder from '../banner/public-reminder'
import Root from './root'

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
  const dispatch = Container.useDispatch()
  const onAttach = (localPaths: Array<string>) =>
    dispatch(
      FsGen.createUploadFromDragAndDrop({
        localPaths,
        parentPath: path,
      })
    )
  return (
    <Kb.DragAndDrop
      allowFolders={true}
      fullWidth={true}
      containerStyle={Styles.globalStyles.flexOne}
      onAttach={!rejectReason ? onAttach : null}
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

const Browser = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Kbfs.Errs />
    <BrowserContent {...props} />
    <Footer path={props.path} />
  </Kb.Box2>
)

export default Browser
