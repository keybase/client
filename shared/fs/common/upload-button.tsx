import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as Styles from '@/styles'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  path: T.FS.Path
  style?: Styles.StylesCrossPlatform
}

type UploadButtonProps = {
  canUpload: boolean
  openAndUploadBoth?: () => void
  openAndUploadDirectory?: () => void
  openAndUploadFile?: () => void
  pickAndUploadFile?: () => void
  pickAndUploadMixed?: () => void
  pickAndUploadPhoto?: () => void
  pickAndUploadVideo?: () => void
  style: Styles.StylesCrossPlatform
}

const UploadButton = (props: UploadButtonProps) => {
  const {pickAndUploadPhoto, pickAndUploadVideo, pickAndUploadFile, openAndUploadDirectory, openAndUploadFile: openAndUploadFileDesktop} = props
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        visible={true}
        onHidden={hidePopup}
        items={[
          ...(props.pickAndUploadMixed ? [{onClick: props.pickAndUploadMixed, title: 'Upload photos/videos'}] : []),
          ...(pickAndUploadPhoto ? [{onClick: pickAndUploadPhoto, title: 'Upload photo'}] : []),
          ...(pickAndUploadVideo ? [{onClick: pickAndUploadVideo, title: 'Upload video'}] : []),
          ...(pickAndUploadFile ? [{onClick: pickAndUploadFile, title: 'Upload file'}] : []),
          ...(openAndUploadDirectory ? [{onClick: openAndUploadDirectory, title: 'Upload directory'}] : []),
          ...(openAndUploadFileDesktop ? [{onClick: openAndUploadFileDesktop, title: 'Upload file'}] : []),
        ]}
        position="bottom left"
        closeOnSelect={true}
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  if (!props.canUpload) {
    return null
  }
  if (props.openAndUploadBoth) {
    return <Kb.Button small={true} onClick={props.openAndUploadBoth} label="Upload" style={props.style} />
  }
  // On mobile, always show the menu (iOS gets mixed + file, Android gets photo + video + file).
  // On non-darwin desktop, show menu for file vs directory.
  return (
    <>
      {C.isMobile ? (
        <Kb.Icon type="iconfont-upload" padding="tiny" onClick={showPopup} />
      ) : (
        <Kb.Button onClick={showPopup} label="Upload" ref={popupAnchor} style={props.style} />
      )}
      {popup}
    </>
  )
}

const Container = (ownProps: OwnProps) => {
  const _pathItem = useFSState(s => FS.getPathItem(s.pathItems, ownProps.path))
  const openAndUploadDesktop = useFSState(s => s.dispatch.defer.openAndUploadDesktop)
  const pickAndUploadMobile = useFSState(s => s.dispatch.defer.pickAndUploadMobile)
  const pickDocumentsMobile = useFSState(s => s.dispatch.defer.pickDocumentsMobile)
  const _openAndUploadBoth = () => {
    openAndUploadDesktop?.(T.FS.OpenDialogType.Both, ownProps.path)
  }
  const openAndUploadBoth = C.isDarwin ? _openAndUploadBoth : undefined
  const _openAndUploadDirectory = () => {
    openAndUploadDesktop?.(T.FS.OpenDialogType.Directory, ownProps.path)
  }
  const openAndUploadDirectory = C.isElectron && !C.isDarwin ? _openAndUploadDirectory : undefined
  const _openAndUploadFile = () => {
    openAndUploadDesktop?.(T.FS.OpenDialogType.File, ownProps.path)
  }
  const openAndUploadFile = C.isElectron && !C.isDarwin ? _openAndUploadFile : undefined
  const _pickAndUploadMixed = () => {
    pickAndUploadMobile?.(T.FS.MobilePickType.Mixed, ownProps.path)
  }
  const pickAndUploadMixed = C.isMobile ? _pickAndUploadMixed : undefined
  const _pickAndUploadPhoto = () => {
    pickAndUploadMobile?.(T.FS.MobilePickType.Photo, ownProps.path)
  }
  const pickAndUploadPhoto = C.isAndroid ? _pickAndUploadPhoto : undefined
  const _pickAndUploadVideo = () => {
    pickAndUploadMobile?.(T.FS.MobilePickType.Video, ownProps.path)
  }
  const pickAndUploadVideo = C.isAndroid ? _pickAndUploadVideo : undefined
  const _pickAndUploadFileMobile = () => {
    pickDocumentsMobile?.(ownProps.path)
  }
  const pickAndUploadFileMobile = C.isMobile ? _pickAndUploadFileMobile : undefined

  const props = {
    canUpload: _pathItem.type === T.FS.PathType.Folder && _pathItem.writable,
    openAndUploadBoth,
    openAndUploadDirectory,
    openAndUploadFile,
    pickAndUploadFile: pickAndUploadFileMobile,
    pickAndUploadMixed: C.isIOS ? pickAndUploadMixed : undefined,
    pickAndUploadPhoto,
    pickAndUploadVideo,
    style: ownProps.style,
  }
  return <UploadButton {...props} />
}

export default Container
