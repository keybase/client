// @flow
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import flags from '../../util/feature-flags'
import {compose, setDisplayName, connect, type Dispatch, type TypedState} from '../../util/container'
import AddNew from './add-new'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _newFolderRow: (parentPath: Types.Path) => dispatch(FsGen.createNewFolderRow({parentPath})),
})

const mergeProps = (stateProps, {_newFolderRow}, {path, style}) => {
  const pathElements = Types.getPathElements(path)
  return {
    pathElements,
    style,
    menuItems:
      pathElements.length <= 2 || !flags.fsWritesEnabled
        ? []
        : [
            {
              onClick: () => {},
              icon: 'iconfont-upload',
              title: 'Upload file or folder',
            },
            {
              // TODO: jump to top of list
              // TODO: focus and select input somehow
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
