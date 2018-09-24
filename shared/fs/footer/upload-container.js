// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Upload from './upload'
import UploadCountdownHOC, {type UploadCountdownHOCProps} from './upload-countdown-hoc'
import {unknownPathItem} from '../../constants/fs'

const mapStateToProps = (state: TypedState) => ({
  _edits: state.fs.edits,
  _pathItems: state.fs.pathItems,
  _uploads: state.fs.uploads,
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

const mergeProps = ({_edits, _pathItems, _uploads}, {debugToggleShow}) => {
  // Filter out folder paths.
  const filePaths = _uploads.syncingPaths.filter(path => {
    const pathType = _pathItems.get(path, unknownPathItem).type
    // If we don't know about this pathType from state.fs.pathItems, it might
    // be a newly created folder and we just haven't heard the result from the
    // folderList RPC triggered by editSuccess yet. So check that. If we know
    // about this pathType from state.fs.pathItems, it must have been loaded
    // from an RPC. So just use that to make sure this is not a folder.
    return pathType === 'unknown'
      ? !_edits.find(
          edit => edit.type === 'new-folder' && Types.pathConcat(edit.parentPath, edit.name) === path
        )
      : pathType !== 'folder'
  })

  return ({
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    files: filePaths.size,
    fileName: filePaths.size === 1 ? Types.getPathName(filePaths.first() || Types.stringToPath('')) : null,
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
