import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import Uploading from './uploading'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _uploads: state.fs.uploads,
})
const mapDispatchToProps = dispatch => ({_retry: dispatch})

const getErrorRetry = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const fsError = stateProps._uploads.errors.get(ownProps.path)
  if (!fsError) {
    return null
  }
  const {retriableAction} = fsError
  if (!retriableAction) {
    return null
  }
  return () => dispatchProps._retry(retriableAction)
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const writingToJournal = stateProps._uploads.writingToJournal.has(ownProps.path)
  const syncing = stateProps._uploads.syncingPaths.has(ownProps.path)

  return {
    errorRetry: getErrorRetry(stateProps, dispatchProps, ownProps),
    path: ownProps.path,
    syncing,
    type: stateProps._pathItem.type,
    writingToJournal,
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedUploadingRow')(
  Uploading
)
