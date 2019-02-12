// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Uploading from './uploading'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _uploads: state.fs.uploads,
})

const mergeProps = ({_pathItem, _uploads}, dispatchProps, {path}: OwnProps) => {
  const error = _uploads.errors.has(path)
  const writingToJournal = _uploads.writingToJournal.has(path)
  const syncing = _uploads.syncingPaths.has(path)

  return {
    error,
    path,
    syncing,
    type: _pathItem.type,
    writingToJournal,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps,
  'ConnectedUploadingRow'
)(Uploading)
