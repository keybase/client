import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import Editing from './editing'

type OwnProps = {
  editID: Types.EditID
}

export default namedConnect(
  (state, {editID}: OwnProps) => ({
    _edit: state.fs.edits.get(editID, Constants.emptyFolder),
  }),
  (dispatch, {editID}: OwnProps) => ({
    onCancel: () => dispatch(FsGen.createDiscardEdit({editID})),
    onSubmit: () => dispatch(FsGen.createCommitEdit({editID})),
    onUpdate: (name: string) => dispatch(FsGen.createNewFolderName({editID, name})),
  }),
  ({_edit}, {onSubmit, onCancel, onUpdate}) => ({
    hint: _edit.hint,
    isCreate: _edit.type === Types.EditType.NewFolder,
    name: _edit.name,
    onCancel,
    onSubmit,
    onUpdate,
    projectedPath: Types.pathConcat(_edit.parentPath, _edit.name),
    status: _edit.status,
  }),

  'EditingRow'
)(Editing)
