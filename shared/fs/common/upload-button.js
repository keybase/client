// @flow
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as React from 'react'
import * as Styles from '../../styles'
import {isDarwin, isMobile, isIOS} from '../../constants/platform'

type OwnProps = {|
  path: Types.Path,
  desktopButtonGap?: ?$Keys<typeof Styles.globalMargins>,
|}

const UploadButton = Kb.OverlayParentHOC(props => {
  if (!props.canUpload) {
    return null
  }
  if (isDarwin) {
    return (
      <Kb.Button
        small={true}
        type="Primary"
        onClick={props.openAndUpload('both')}
        label="Upload"
        style={
          props.desktopButtonGap && {
            marginLeft: Styles.globalMargins[props.desktopButtonGap],
            marginRight: Styles.globalMargins[props.desktopButtonGap],
          }
        }
      />
    )
  }
  if (isIOS) {
    return <Kb.Icon type="iconfont-new" padding="tiny" onClick={props.pickAndUpload('mixed')} />
  }
  // Either Android, or non-darwin desktop. Android doesn't support mixed
  // mode; Linux/Windows don't support opening file or dir from the same
  // dialog. In both cases a menu is needed.
  return (
    <>
      {isMobile ? (
        <Kb.Icon type="iconfont-new" padding="tiny" onClick={props.toggleShowingMenu} />
      ) : (
        <Kb.Button
          type="Primary"
          onClick={props.toggleShowingMenu}
          label="Upload"
          ref={props.setAttachmentRef}
          style={
            props.desktopButtonGap && {
              marginLeft: Styles.globalMargins[props.desktopButtonGap],
              marginRight: Styles.globalMargins[props.desktopButtonGap],
            }
          }
        />
      )}
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        onHidden={props.toggleShowingMenu}
        items={
          isMobile
            ? [
                {
                  onClick: () => props.pickAndUpload('photo'),
                  title: 'Upload photo',
                },
                {
                  onClick: () => props.pickAndUpload('video'),
                  title: 'Upload video',
                },
              ]
            : [
                {
                  onClick: () => props.openAndUpload('directory'),
                  title: 'Upload directory',
                },
                {
                  onClick: () => props.openAndUpload('file'),
                  title: 'Upload file',
                },
              ]
        }
        position="bottom left"
        closeOnSelect={true}
      />
    </>
  )
})

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path}) => ({
  openAndUpload: (type: Types.OpenDialogType) => () =>
    dispatch(FsGen.createOpenAndUpload({parentPath: path, type})),
  pickAndUpload: (type: Types.MobilePickType) => () =>
    dispatch(FsGen.createPickAndUpload({parentPath: path, type})),
})

const mergeProps = (s, d, o) => ({
  canUpload: s._pathItem.type === 'folder' && s._pathItem.writable,
  desktopButtonGap: o.desktopButtonGap,
  ...d,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UploadButton'
)(UploadButton)
