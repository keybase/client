import * as T from '@/constants/types'
import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {
  pickAndUploadMobile as pickAndUploadInPlatform,
  pickDocumentsMobile as pickDocumentsInPlatform,
  selectFilesToUploadDesktop as selectFilesToUploadInPlatform,
} from '@/util/fs-platform'
import {useFsErrorActionOrThrow} from './error-state'
import {useFsPathItem, useFsUpload} from './hooks'

type OwnProps = {
  path: T.FS.Path
  // Render a dimmed, inert icon instead of nothing when uploading isn't
  // allowed, so containers with a fixed layout (iOS header pill) don't resize.
  showDisabled?: boolean
  // Render no trigger button, only the popup. The upload menu is opened
  // imperatively through the ref handle (used by the iOS native header menu).
  hideTrigger?: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

export type UploadButtonHandle = {open: () => void}

type UploadButtonProps = {
  canUpload: boolean
  showDisabled?: boolean
  hideTrigger?: boolean
  openAndUploadBoth?: () => void
  openAndUploadDirectory?: () => void
  openAndUploadFile?: () => void
  pickAndUploadFile?: () => void
  pickAndUploadMixed?: () => void
  pickAndUploadPhoto?: () => void
  pickAndUploadVideo?: () => void
  style: Kb.Styles.StylesCrossPlatform
}

const UploadButton = React.forwardRef<UploadButtonHandle, UploadButtonProps>((props, ref) => {
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

  const {canUpload, hideTrigger} = props
  React.useImperativeHandle(ref, () => ({
    open: () => {
      if (canUpload) {
        showPopup()
      }
    },
  }))

  if (hideTrigger) {
    return <>{popup}</>
  }

  if (!props.canUpload) {
    return props.showDisabled ? (
      <Kb.Icon type="iconfont-upload" padding="tiny" color={Kb.Styles.globalColors.black_20} />
    ) : null
  }
  if (props.openAndUploadBoth) {
    return <Kb.Button small={true} onClick={props.openAndUploadBoth} label="Upload" style={props.style} />
  }
  // On mobile, always show the menu (iOS gets mixed + file, Android gets photo + video + file).
  // On non-darwin desktop, show menu for file vs directory.
  return (
    <>
      {isMobile ? (
        <Kb.Icon type="iconfont-upload" padding="tiny" onClick={showPopup} />
      ) : (
        <Kb.Button onClick={showPopup} label="Upload" ref={popupAnchor} style={props.style} />
      )}
      {popup}
    </>
  )
})
UploadButton.displayName = 'UploadButtonInner'

const Container = React.forwardRef<UploadButtonHandle, OwnProps>((ownProps, ref) => {
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
  const openAndUploadDirectory = isElectron && !C.isDarwin ? _openAndUploadDirectory : undefined
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
  const openAndUploadFile = isElectron && !C.isDarwin ? _openAndUploadFile : undefined
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
  const pickAndUploadMixed = isMobile ? _pickAndUploadMixed : undefined
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
  const pickAndUploadPhoto = isAndroid ? _pickAndUploadPhoto : undefined
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
  const pickAndUploadVideo = isAndroid ? _pickAndUploadVideo : undefined
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
  const pickAndUploadFileMobile = isMobile ? _pickAndUploadFileMobile : undefined

  const props = {
    canUpload: _pathItem.type === T.FS.PathType.Folder && _pathItem.writable,
    hideTrigger: ownProps.hideTrigger,
    openAndUploadBoth,
    openAndUploadDirectory,
    openAndUploadFile,
    pickAndUploadFile: pickAndUploadFileMobile,
    pickAndUploadMixed: isIOS ? pickAndUploadMixed : undefined,
    pickAndUploadPhoto,
    pickAndUploadVideo,
    showDisabled: ownProps.showDisabled,
    style: ownProps.style,
  }
  return <UploadButton ref={ref} {...props} />
})

Container.displayName = 'UploadButton'

export default Container
