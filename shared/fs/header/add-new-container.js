// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {namedConnect} from '../../util/container'
import AddNew from './add-new'
import {isDarwin, isMobile, isIOS} from '../../constants/platform'

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch, {path: parentPath, routePath}) => ({
  _openAndUpload: (type: Types.OpenDialogType) => () =>
    dispatch(FsGen.createOpenAndUpload({parentPath, type})),
  _pickAndUpload: (type: Types.MobilePickType) => () =>
    dispatch(FsGen.createPickAndUpload({parentPath, type})),
  newFolderRow: () => dispatch(FsGen.createNewFolderRow({parentPath})),
})

const mergeProps = ({_pathItem}, {newFolderRow, _openAndUpload, _pickAndUpload}, {path, style}) => {
  const pathElements = Types.getPathElements(path)
  return {
    pathElements,
    style,
    ...(pathElements.length > 2 && _pathItem.writable
      ? {
          ...(isMobile
            ? isIOS
              ? {pickAndUploadMixed: _pickAndUpload('mixed')}
              : {
                  pickAndUploadPhoto: _pickAndUpload('photo'),
                  pickAndUploadVideo: _pickAndUpload('video'),
                }
            : isDarwin
            ? {openAndUploadBoth: _openAndUpload('both')}
            : {
                openAndUploadDir: _openAndUpload('directory'),
                openAndUploadFile: _openAndUpload('file'),
              }),
          newFolderRow,
        }
      : {}),
  }
}

// $FlowIssue @jzila
export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedAddNew')(AddNew)
