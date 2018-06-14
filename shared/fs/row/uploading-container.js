// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Uploading from './uploading'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
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
  const parentPath = Types.getPathParent(path)
  const upload = _uploads.get(parentPath, I.Map()).get(name, Constants.makeUpload())

  return {
    name,
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), _pathItem.type, _username),
    upload,
  }
}

export default compose(
  connect(mapStateToProps, undefined, mergeProps),
  setDisplayName('ConnectedUploadingRow')
)(Uploading)
