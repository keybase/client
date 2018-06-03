// @flow
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Editing from './editing'

const mapStateToProps = (state: TypedState, {path}) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _username,
    _pathItem,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {path, routePath}) => ({
  onSubmit: name =>
    dispatch(FsGen.createNewFolder({path: Types.pathConcat(Types.getPathParent(path), name)})),
  onCancel: () => dispatch(FsGen.createNewFolderRowClear({path})),
})

const mergeProps = ({_pathItem, _username}, {onSubmit, onCancel}, {path, isCreate}) => ({
  name: _pathItem.name,
  status: _pathItem.status,
  itemStyles: Constants.getItemStyles(Types.getPathElements(path), _pathItem.type, _username),
  isCreate,
  onSubmit,
  onCancel,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('EditingRow')
)(Editing)
