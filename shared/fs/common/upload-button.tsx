import * as React from 'react'
import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Platforms from '../../constants/platform'
import type * as Styles from '../../styles'

type OwnProps = {
  path: Types.Path
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
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={toggleShowingPopup}
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
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
      {Platforms.isMobile ? (
        <Kb.Icon type="iconfont-upload" padding="tiny" onClick={toggleShowingPopup} />
      ) : (
        <Kb.Button onClick={toggleShowingPopup} label="Upload" ref={popupAnchor} style={props.style} />
      )}
      {popup}
    </>
  )
}

export default (ownProps: OwnProps) => {
  const _pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, ownProps.path))
  const dispatch = Container.useDispatch()
  const _openAndUploadBoth = () => {
    dispatch(FsGen.createOpenAndUpload({parentPath: ownProps.path, type: Types.OpenDialogType.Both}))
  }
  const openAndUploadBoth = Platforms.isDarwin ? _openAndUploadBoth : undefined
  const _openAndUploadDirectory = () => {
    dispatch(FsGen.createOpenAndUpload({parentPath: ownProps.path, type: Types.OpenDialogType.Directory}))
  }
  const openAndUploadDirectory =
    Platforms.isElectron && !Platforms.isDarwin ? _openAndUploadDirectory : undefined
  const _openAndUploadFile = () => {
    dispatch(FsGen.createOpenAndUpload({parentPath: ownProps.path, type: Types.OpenDialogType.File}))
  }
  const openAndUploadFile = Platforms.isElectron && !Platforms.isDarwin ? _openAndUploadFile : undefined
  const _pickAndUploadMixed = () => {
    dispatch(FsGen.createPickAndUpload({parentPath: ownProps.path, type: Types.MobilePickType.Mixed}))
  }
  const pickAndUploadMixed = Platforms.isIOS ? _pickAndUploadMixed : undefined
  const _pickAndUploadPhoto = () => {
    dispatch(FsGen.createPickAndUpload({parentPath: ownProps.path, type: Types.MobilePickType.Photo}))
  }
  const pickAndUploadPhoto = Platforms.isAndroid ? _pickAndUploadPhoto : undefined
  const _pickAndUploadVideo = () => {
    dispatch(FsGen.createPickAndUpload({parentPath: ownProps.path, type: Types.MobilePickType.Video}))
  }
  const pickAndUploadVideo = Platforms.isAndroid ? _pickAndUploadVideo : undefined

  const props = {
    canUpload: _pathItem.type === 'folder' && _pathItem.writable,
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
