// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import Header from './header'

type OwnProps = {|
  path: Types.Path,
|}

const mapStateToProps = (state, {path}) => ({
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  loadFolderList: () => dispatch(FsGen.createFolderListLoad({path, refreshTag: 'path-item-action-popup'})),
  loadMimeType: () => dispatch(FsGen.createMimeTypeLoad({path, refreshTag: 'path-item-action-popup'})),
})

const getChildrenNumbers = (_pathItems, _pathItem, path) =>
  _pathItem.type === 'folder' && _pathItem.children
    ? _pathItem.children.reduce(
        ({childrenFolders, childrenFiles}, p) => {
          const isFolder =
            _pathItems.get(Types.pathConcat(path, p), Constants.unknownPathItem).type === 'folder'
          return {
            childrenFiles: childrenFiles + (isFolder ? 0 : 1),
            childrenFolders: childrenFolders + (isFolder ? 1 : 0),
          }
        },
        {childrenFiles: 0, childrenFolders: 0}
      )
    : {childrenFiles: 0, childrenFolders: 0}

const mergeProps = ({_pathItems}, {loadFolderList, loadMimeType}, {path}) => {
  const _pathItem = _pathItems.get(path, Constants.unknownPathItem)
  return {
    ...getChildrenNumbers(_pathItems, _pathItem, path), // provides childrenFiles and childrenFolders
    loadFolderList,
    loadMimeType,
    path,
    size: _pathItem.size,
    type: Types.getPathLevel(path) <= 3 ? 'folder' : _pathItem.type,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionMenuHeader'
)(Header)
