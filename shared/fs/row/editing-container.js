// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Editing from './editing'

type OwnProps = {
  editID: Types.EditID,
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {editID}: OwnProps) => {
  const _edit = state.fs.edits.get(editID, Constants.makeNewFolder()) // TODO make missing get better
  const _username = state.config.username
  return {
    _username,
    _edit,
  }
}

const mapDispatchToProps = (dispatch, {editID, routePath}: OwnProps) => ({
  onSubmit: () => dispatch(FsGen.createCommitEdit({editID})),
  onUpdate: (name: string) => dispatch(FsGen.createNewFolderName({editID, name})),
  onCancel: () => dispatch(FsGen.createDiscardEdit({editID})),
})

const mergeProps = ({_edit, _username}, {onSubmit, onCancel, onUpdate}) => ({
  name: _edit.name,
  hint: _edit.hint,
  status: _edit.status,
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(Types.pathConcat(_edit.parentPath, _edit.name)),
    Constants.editTypeToPathType(_edit.type),
    _username
  ),
  isCreate: _edit.type === 'new-folder',
  onSubmit,
  onCancel,
  onUpdate,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('EditingRow')
)(Editing)
