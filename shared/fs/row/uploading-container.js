// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Uploading from './uploading'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state, {path}: OwnProps) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  const _uploads = state.fs.uploads
  const _username = state.config.username
  return {
    _pathItem,
    _uploads,
    _username,
  }
}

const mergeProps = ({_pathItem, _uploads, _username}, dispatchProps, {path}: OwnProps) => {
  const name = Types.getPathName(path)
  const error = _uploads.errors.has(path)
  const writingToJournal = _uploads.writingToJournal.has(path)
  const syncing = _uploads.syncingPaths.has(path)

  return {
    error,
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), _pathItem.type, _username),
    name,
    syncing,
    writingToJournal,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps,
  'ConnectedUploadingRow'
)(Uploading)
