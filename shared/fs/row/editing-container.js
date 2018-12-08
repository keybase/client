// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Editing from './editing'

type OwnProps = {
  editID: Types.EditID,
  routePath: I.List<string>,
}

const mapStateToProps = (state, {editID}: OwnProps) => {
  const _edit = state.fs.edits.get(editID, Constants.makeNewFolder()) // TODO make missing get better
  const _username = state.config.username
  return {
    _edit,
    _username,
  }
}

const mapDispatchToProps = (dispatch, {editID, routePath}: OwnProps) => ({
  onCancel: () => dispatch(FsGen.createDiscardEdit({editID})),
  onSubmit: () => dispatch(FsGen.createCommitEdit({editID})),
  onUpdate: (name: string) => dispatch(FsGen.createNewFolderName({editID, name})),
})

const mergeProps = ({_edit, _username}, {onSubmit, onCancel, onUpdate}) => ({
  hint: _edit.hint,
  isCreate: _edit.type === 'new-folder',
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(Types.pathConcat(_edit.parentPath, _edit.name)),
    Constants.editTypeToPathType(_edit.type),
    _username
  ),
  name: _edit.name,
  onCancel,
  onSubmit,
  onUpdate,
  status: _edit.status,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'EditingRow'
)(Editing)
