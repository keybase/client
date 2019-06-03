import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import Header, {Props} from './header'

type OwnProps = {
  path: Types.Path
}

type StateProps = {
  _pathItems: Types.PathItems
}
type DispatchProps = {
  loadFolderList: () => void
  loadPathMetadata: () => void
}
const mapStateToProps = (state, {path}: OwnProps): StateProps => ({
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  loadFolderList: () =>
    dispatch(FsGen.createFolderListLoad({path, refreshTag: Types.RefreshTag.PathItemActionPopup})),
  loadPathMetadata: () =>
    dispatch(FsGen.createLoadPathMetadata({path, refreshTag: Types.RefreshTag.PathItemActionPopup})),
})

const getChildrenNumbers = (_pathItems, _pathItem, path) =>
  _pathItem.type === Types.PathType.Folder && _pathItem.children
    ? _pathItem.children.reduce(
        ({childrenFolders, childrenFiles}, p) => {
          const isFolder =
            _pathItems.get(Types.pathConcat(path, p), Constants.unknownPathItem).type ===
            Types.PathType.Folder
          return {
            childrenFiles: childrenFiles + (isFolder ? 0 : 1),
            childrenFolders: childrenFolders + (isFolder ? 1 : 0),
          }
        },
        {childrenFiles: 0, childrenFolders: 0}
      )
    : {childrenFiles: 0, childrenFolders: 0}

const mergeProps = (s: StateProps, d: DispatchProps, o: OwnProps): Props => {
  const _pathItem = s._pathItems.get(o.path, Constants.unknownPathItem)
  return {
    ...getChildrenNumbers(s._pathItems, _pathItem, o.path), // provides
    // childrenFiles and childrenFolders
    ...d,
    ...o,

    size: _pathItem.size,
    type: Types.getPathLevel(o.path) <= 3 ? Types.PathType.Folder : _pathItem.type,
  }
}

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemActionMenuHeader'
)(Header)
