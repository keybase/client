import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as Styles from '@/styles'

type OwnProps = {
  path: T.FS.Path
  style?: Styles.StylesCrossPlatform
}

type UploadButtonProps = {
  canUpload: boolean
  openAndUploadBoth?: () => void
  openAndUploadDirectory?: () => void
  openAndUploadFile?: () => void
  pickAndUploadMixed?: () => void
  pickAndUploadPhoto?: () => void
  pickAndUploadVideo?: () => void
  style: Styles.StylesCrossPlatform
}

const UploadButton = (props: UploadButtonProps) => {
  const {pickAndUploadPhoto, pickAndUploadVideo, openAndUploadDirectory, openAndUploadFile} = props
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={hidePopup}
          items={[
            ...(pickAndUploadPhoto ? [{onClick: pickAndUploadPhoto, title: 'Upload photo'}] : []),
            ...(pickAndUploadVideo ? [{onClick: pickAndUploadVideo, title: 'Upload video'}] : []),
            ...(openAndUploadDirectory ? [{onClick: openAndUploadDirectory, title: 'Upload directory'}] : []),
            ...(openAndUploadFile ? [{onClick: openAndUploadFile, title: 'Upload file'}] : []),
          ]}
          position="bottom left"
          closeOnSelect={true}
        />
      )
    },
    [openAndUploadDirectory, openAndUploadFile, pickAndUploadPhoto, pickAndUploadVideo]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  if (!props.canUpload) {
    return null
  }
  if (props.openAndUploadBoth) {
    return <Kb.Button small={true} onClick={props.openAndUploadBoth} label="Upload" style={props.style} />
  }
  if (props.pickAndUploadMixed) {
    return <Kb.Icon type="iconfont-upload" padding="tiny" onClick={props.pickAndUploadMixed} />
  }
  // Either Android, or non-darwin desktop. Android doesn't support mixed
  // mode; Linux/Windows don't support opening file or dir from the same
  // dialog. In both cases a menu is needed.
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
  const _pathItem = C.useFSState(s => C.FS.getPathItem(s.pathItems, ownProps.path))
  const openAndUploadDesktop = C.useFSState(s => s.dispatch.dynamic.openAndUploadDesktop)
  const pickAndUploadMobile = C.useFSState(s => s.dispatch.dynamic.pickAndUploadMobile)
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
  const pickAndUploadMixed = C.isIOS ? _pickAndUploadMixed : undefined
  const _pickAndUploadPhoto = () => {
    pickAndUploadMobile?.(T.FS.MobilePickType.Photo, ownProps.path)
  }
  const pickAndUploadPhoto = C.isAndroid ? _pickAndUploadPhoto : undefined
  const _pickAndUploadVideo = () => {
    pickAndUploadMobile?.(T.FS.MobilePickType.Video, ownProps.path)
  }
  const pickAndUploadVideo = C.isAndroid ? _pickAndUploadVideo : undefined

  const props = {
    canUpload: _pathItem.type === T.FS.PathType.Folder && _pathItem.writable,
    openAndUploadBoth,
    openAndUploadDirectory,
    openAndUploadFile,
    pickAndUploadMixed,
    pickAndUploadPhoto,
    pickAndUploadVideo,
    style: ownProps.style,
  }
  return <UploadButton {...props} />
}

export default Container
