// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import Upload, {type UploadProps} from './upload'
import {formatDurationFromNowTo} from '../../util/timestamp'

const mapStateToProps = (state: TypedState) => ({
  _uploads: state.fs.uploads,
})

// NOTE flip this to show a button to debug the upload banner animations.
const enableDebugUploadBanner = true

const mapDispatchToProps = (dispatch: Dispatch) => ({
  debugToggleShow: !enableDebugUploadBanner
    ? undefined
    : (() => {
        let tmp = false
        return () => {
          dispatch(
            FsGen.createJournalUpdate({
              syncingPaths: tmp ? [] : [Types.stringToPath('/keybase')],
              totalSyncingBytes: 0, // not needed to trigger upload banner
            })
          )
          tmp = !tmp
        }
      })(),
})

const mergeProps = ({_uploads}, {debugToggleShow}) =>
  ({
    files: _uploads.syncingPaths.merge(_uploads.writingToJournal).size,
    timeLeft: '32 s' || formatDurationFromNowTo(_uploads.endEstimate),
    debugToggleShow,
  }: UploadProps)

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedUpload')
)(Upload)
