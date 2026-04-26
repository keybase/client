import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as Styles from '@/styles'
import {
  pickAndUploadMobile as pickAndUploadInPlatform,
  pickDocumentsMobile as pickDocumentsInPlatform,
  selectFilesToUploadDesktop as selectFilesToUploadInPlatform,
} from '@/stores/fs-platform'
import {useFsErrorActionOrThrow} from './error-state'
import {useFsPathItem, useFsUpload} from './hooks'

type OwnProps = {
  path: T.FS.Path
  style?: Styles.StylesCrossPlatform | undefined
}

type UploadButtonProps = {
  canUpload: boolean
  openAndUploadBoth?: (() => void) | undefined
  openAndUploadDirectory?: (() => void) | undefined
  openAndUploadFile?: (() => void) | undefined
  pickAndUploadFile?: (() => void) | undefined
  pickAndUploadMixed?: (() => void) | undefined
  pickAndUploadPhoto?: (() => void) | undefined
  pickAndUploadVideo?: (() => void) | undefined
  style?: Styles.StylesCrossPlatform | undefined
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
  const _pathItem = useFsPathItem(ownProps.path)
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const upload = useFsUpload()
  const _openAndUploadBoth = () => {
    const f = async () => {
      try {
        const localPaths = await selectFilesToUploadInPlatform(T.FS.OpenDialogType.Both, ownProps.path)
        localPaths.forEach(localPath => upload(ownProps.path, localPath))
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }
  const openAndUploadBoth = C.isDarwin ? _openAndUploadBoth : undefined
  const _openAndUploadDirectory = () => {
    const f = async () => {
      try {
        const localPaths = await selectFilesToUploadInPlatform(T.FS.OpenDialogType.Directory, ownProps.path)
        localPaths.forEach(localPath => upload(ownProps.path, localPath))
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }
  const openAndUploadDirectory = C.isElectron && !C.isDarwin ? _openAndUploadDirectory : undefined
  const _openAndUploadFile = () => {
    const f = async () => {
      try {
        const localPaths = await selectFilesToUploadInPlatform(T.FS.OpenDialogType.File, ownProps.path)
        localPaths.forEach(localPath => upload(ownProps.path, localPath))
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }
  const openAndUploadFile = C.isElectron && !C.isDarwin ? _openAndUploadFile : undefined
  const _pickAndUploadMixed = () => {
    const f = async () => {
      try {
        await pickAndUploadInPlatform(T.FS.MobilePickType.Mixed, ownProps.path, upload)
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }
  const pickAndUploadMixed = C.isMobile ? _pickAndUploadMixed : undefined
  const _pickAndUploadPhoto = () => {
    const f = async () => {
      try {
        await pickAndUploadInPlatform(T.FS.MobilePickType.Photo, ownProps.path, upload)
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }
  const pickAndUploadPhoto = C.isAndroid ? _pickAndUploadPhoto : undefined
  const _pickAndUploadVideo = () => {
    const f = async () => {
      try {
        await pickAndUploadInPlatform(T.FS.MobilePickType.Video, ownProps.path, upload)
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
  }
  const pickAndUploadVideo = C.isAndroid ? _pickAndUploadVideo : undefined
  const _pickAndUploadFileMobile = () => {
    const f = async () => {
      try {
        await pickDocumentsInPlatform(ownProps.path, upload)
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    C.ignorePromise(f())
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
