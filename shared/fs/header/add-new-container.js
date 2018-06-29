// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import flags from '../../util/feature-flags'
import {compose, setDisplayName, connect, type Dispatch, type TypedState} from '../../util/container'
import AddNew from './add-new'
import {isDarwin, isMobile, isIOS} from '../../constants/platform'

const mapStateToProps = (state: TypedState, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _newFolderRow: (parentPath: Types.Path) => dispatch(FsGen.createNewFolderRow({parentPath})),
  _upload: (parentPath: Types.Path, type: Types.OpenDialogType) =>
    dispatch(FsGen.createPickAndUpload({parentPath, type})),
})

const desktopUploadItems = (path: Types.Path, _upload) =>
  isDarwin
    ? [
        {
          onClick: () => _upload(path, 'both'),
          icon: 'iconfont-upload',
          title: 'Upload a file or folder',
        },
      ]
    : [
        // Linux/Windows don't support accepting file and dir at the same time.
        {
          onClick: () => _upload(path, 'file'),
          icon: 'iconfont-upload',
          title: 'Upload a file',
        },
        {
          onClick: () => _upload(path, 'directory'),
          icon: 'iconfont-upload',
          title: 'Upload a folder',
        },
        'Divider',
      ]

const mobileUploadItems = (path: Types.Path, _upload) => [
  {
    onClick: () => _upload(path, 'file'),
    icon: 'iconfont-upload',
    title: `Upload an image${isIOS ? ' or video' : ''}`, // 'mixed' mode is not supported on Android. See actions/fs/common.native.js
  },
]

const mergeProps = ({_pathItem}, {_newFolderRow, _upload}, {path, style}) => {
  const pathElements = Types.getPathElements(path)
  return {
    pathElements,
    style,
    menuItems:
      flags.fsWritesEnabled && pathElements.length > 2 && _pathItem.writable
        ? []
        : [
            ...(isMobile ? mobileUploadItems(path, _upload) : desktopUploadItems(path, _upload)),
            {
              // TODO: jump to top of list
              onClick: () => _newFolderRow(path),
              icon: 'iconfont-folder-new',
              title: 'New folder',
            },
          ],
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedAddNew')
)(AddNew)
