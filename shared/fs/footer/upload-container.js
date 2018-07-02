// @flow
import {connect, type TypedState} from '../../util/container'
import Upload, {type UploadProps} from './upload'
import {formatDurationFromNowTo} from '../../util/timestamp'

const mapStateToProps = (state: TypedState) => ({
  _uploads: state.fs.uploads,
})

const mergeProps = ({_uploads}, dispatchProps, ownProps) =>
  ({
    files: _uploads.syncingPaths.merge(_uploads.writingToJournal).size,
    timeLeft: formatDurationFromNowTo(_uploads.endEstimate),
  }: UploadProps)

export default connect(mapStateToProps, undefined, mergeProps)(Upload)
