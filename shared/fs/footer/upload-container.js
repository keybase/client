// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Upload from './upload'
import UploadCountdownHOC, {type UploadCountdownHOCProps} from './upload-countdown-hoc'
import {unknownPathItem} from '../../constants/fs'

const mapStateToProps = (state: TypedState) => ({
  _uploads: state.fs.uploads,
  _pathItems: state.fs.pathItems,
})

// NOTE flip this to show a button to debug the upload banner animations.
const enableDebugUploadBanner = false

const getDebugToggleShow = (dispatch: Dispatch) => {
  if (!(__DEV__ && enableDebugUploadBanner)) {
    return undefined
  }

  let showing = false
  return () => {
    dispatch(
      FsGen.createJournalUpdate({
        syncingPaths: showing ? [] : [Types.stringToPath('/keybase')],
        totalSyncingBytes: 0, // not needed to trigger upload banner
      })
    )
    showing = !showing
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  debugToggleShow: getDebugToggleShow(dispatch),
})

const mergeProps = ({_uploads, _pathItems}, {debugToggleShow}) => {
  const filePaths = _uploads.syncingPaths.filter(
    path => _pathItems.get(path, unknownPathItem).type !== 'folder'
  )

  return ({
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    files: filePaths.size,
    fileName: filePaths.size === 1 ? filePaths.first() : undefined,
    endEstimate: enableDebugUploadBanner ? _uploads.endEstimate + 32000 : _uploads.endEstimate,
    totalSyncingBytes: _uploads.totalSyncingBytes,
    debugToggleShow,
  }: UploadCountdownHOCProps)
}

export default compose(
  // $FlowIssue @jzila
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedUpload'),
  UploadCountdownHOC
)(Upload)
