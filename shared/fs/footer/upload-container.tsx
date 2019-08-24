import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, namedConnect} from '../../util/container'
import Upload, {UploadProps} from './upload'
import UploadCountdownHOC, {UploadCountdownHOCProps} from './upload-countdown-hoc'
import {unknownPathItem} from '../../constants/fs'
import * as Kbfs from '../common'
import flags from '../../util/feature-flags'

const mapStateToProps = state => ({
  _edits: state.fs.edits,
  _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  _pathItems: state.fs.pathItems,
  _uploads: state.fs.uploads,
})

// NOTE flip this to show a button to debug the upload banner animations.
const enableDebugUploadBanner = false

const getDebugToggleShow = dispatch => {
  if (!(__DEV__ && enableDebugUploadBanner)) {
    return undefined
  }

  let showing = false
  return () => {
    dispatch(
      FsGen.createJournalUpdate({
        endEstimate: showing ? null : Date.now() + 1000 * 60 * 60,
        syncingPaths: showing ? [] : [Types.stringToPath('/keybase')],
        totalSyncingBytes: showing ? 0 : 1,
      })
    )
    showing = !showing
  }
}

const mapDispatchToProps = dispatch => ({
  debugToggleShow: getDebugToggleShow(dispatch),
})

export const uploadsToUploadCountdownHOCProps = (
  edits: Types.Edits,
  pathItems: Types.PathItems,
  uploads: Types.Uploads
) => {
  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = uploads.syncingPaths.filter(path => {
    const pathType = pathItems.get(path, unknownPathItem).type
    // If we don't know about this pathType from state.fs.pathItems, it might
    // be a newly created folder and we just haven't heard the result from the
    // folderList RPC triggered by editSuccess yet. So check that. If we know
    // about this pathType from state.fs.pathItems, it must have been loaded
    // from an RPC. So just use that to make sure this is not a folder.
    return pathType === Types.PathType.Unknown
      ? !edits.find(
          edit =>
            edit.type === Types.EditType.NewFolder && Types.pathConcat(edit.parentPath, edit.name) === path
        )
      : pathType !== Types.PathType.Folder
  })

  return {
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    endEstimate: enableDebugUploadBanner ? (uploads.endEstimate || 0) + 32000 : uploads.endEstimate || 0,
    fileName: filePaths.size === 1 ? Types.getPathName(filePaths.first() || Types.stringToPath('')) : null,
    files: filePaths.size,
    totalSyncingBytes: uploads.totalSyncingBytes,
  }
}

const mergeProps = ({_edits, _kbfsDaemonStatus, _pathItems, _uploads}, {debugToggleShow}) =>
  ({
    ...uploadsToUploadCountdownHOCProps(_edits, _pathItems, _uploads),
    debugToggleShow,
    isOnline:
      !flags.kbfsOfflineMode || _kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Online,
  } as UploadCountdownHOCProps)

export default compose(
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedUpload'),
  UploadCountdownHOC
)((props: UploadProps) => {
  Kbfs.useFsJournalStatus()
  return <Upload {...props} />
})
