// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import Header from './header'

type OwnProps = {|
  path: Types.Path,
|}

const mapStateToProps = (state, {path}) => ({
  _pathItems: state.fs.pathItems,
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

const mergeProps = ({_pathItems}, dispatchProps, {path}) => {
  const _pathItem = _pathItems.get(path, Constants.unknownPathItem)
  return {
    ...getChildrenNumbers(_pathItems, _pathItem, path), // provides childrenFiles and childrenFolders
    path,
    size: _pathItem.size,
    type: Types.getPathLevel(path) <= 3 ? 'folder' : _pathItem.type,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => {},
  mergeProps,
  'PathItemActionMenuHeader'
)(Header)
