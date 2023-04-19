import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Platforms from '../../constants/platform'
import type * as Styles from '../../styles'

type OwnProps = {
  path: Types.Path
  style?: Styles.StylesCrossPlatform | null
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  _pathItem: Constants.getPathItem(state.fs.pathItems, ownProps.path),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  openAndUploadBoth: Platforms.isDarwin
    ? () => dispatch(FsGen.createOpenAndUpload({parentPath: ownProps.path, type: Types.OpenDialogType.Both}))
    : null,
  openAndUploadDirectory:
    Platforms.isElectron && !Platforms.isDarwin
      ? () =>
          dispatch(
            FsGen.createOpenAndUpload({parentPath: ownProps.path, type: Types.OpenDialogType.Directory})
          )
      : null,
  openAndUploadFile:
    Platforms.isElectron && !Platforms.isDarwin
      ? () =>
          dispatch(FsGen.createOpenAndUpload({parentPath: ownProps.path, type: Types.OpenDialogType.File}))
      : null,
  pickAndUploadMixed: Platforms.isIOS
    ? () => dispatch(FsGen.createPickAndUpload({parentPath: ownProps.path, type: Types.MobilePickType.Mixed}))
    : null,
  pickAndUploadPhoto: Platforms.isAndroid
    ? () => dispatch(FsGen.createPickAndUpload({parentPath: ownProps.path, type: Types.MobilePickType.Photo}))
    : null,
  pickAndUploadVideo: Platforms.isAndroid
    ? () => dispatch(FsGen.createPickAndUpload({parentPath: ownProps.path, type: Types.MobilePickType.Video}))
    : null,
})

const mergeProps = (
  s: ReturnType<typeof mapStateToProps>,
  d: ReturnType<typeof mapDispatchToProps>,
  o: OwnProps
) => ({
  canUpload: s._pathItem.type === 'folder' && s._pathItem.writable,
  style: o.style,
  ...d,
})

type UploadButtonProps = ReturnType<typeof mergeProps>

const UploadButton = (props: UploadButtonProps) => {
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      items={[
        ...(props.pickAndUploadPhoto ? [{onClick: props.pickAndUploadPhoto, title: 'Upload photo'}] : []),
        ...(props.pickAndUploadVideo ? [{onClick: props.pickAndUploadVideo, title: 'Upload video'}] : []),
        ...(props.openAndUploadDirectory
          ? [{onClick: props.openAndUploadDirectory, title: 'Upload directory'}]
          : []),
        ...(props.openAndUploadFile ? [{onClick: props.openAndUploadFile, title: 'Upload file'}] : []),
      ]}
      position="bottom left"
      closeOnSelect={true}
    />
  ))

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

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(UploadButton)
