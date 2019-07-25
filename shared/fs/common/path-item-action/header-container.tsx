import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import Header, {Props} from './header'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state: Container.TypedState) => ({
  _pathItems: state.fs.pathItems,
})

const mapDispatchToProps = () => ({})

const getChildrenNumbers = (_pathItems: Types.PathItems, _pathItem: Types.PathItem, path: Types.Path) =>
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

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps): Props => {
    const _pathItem = s._pathItems.get(o.path, Constants.unknownPathItem)
    return {
      ...getChildrenNumbers(s._pathItems, _pathItem, o.path), // provides
      // childrenFiles and childrenFolders
      ...d,
      ...o,

      size: _pathItem.size,
      type: Types.getPathLevel(o.path) <= 3 ? Types.PathType.Folder : _pathItem.type,
    }
  },
  'PathItemActionMenuHeader'
)(Header)
