import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import Uploading from './uploading'

type OwnProps = {
  path: Types.Path
}

export default namedConnect(
  (state, {path}: OwnProps) => ({
    _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
    _uploads: state.fs.uploads,
  }),
  dispatch => ({_retry: dispatch}),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const writingToJournal = stateProps._uploads.writingToJournal.has(ownProps.path)
    const syncing = stateProps._uploads.syncingPaths.has(ownProps.path)
    const retriableAction = (stateProps._uploads.errors.get(ownProps.path) || Constants.emptyError)
      .retriableAction

    return {
      errorRetry: retriableAction ? () => dispatchProps._retry(retriableAction) : undefined,
      path: ownProps.path,
      syncing,
      type: stateProps._pathItem.type,
      writingToJournal,
    }
  },
  'ConnectedUploadingRow'
)(Uploading)
