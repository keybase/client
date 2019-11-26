import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, namedConnect} from '../../util/container'
import Upload, {UploadProps} from './upload'
import UploadCountdownHOC, {UploadCountdownHOCProps} from './upload-countdown-hoc'
import * as Constants from '../../constants/fs'
import * as Kbfs from '../common'
import flags from '../../util/feature-flags'

const mapStateToProps = state => ({
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

export const uploadsToUploadCountdownHOCProps = (pathItems: Types.PathItems, uploads: Types.Uploads) => {
  // We just use syncingPaths rather than merging with writingToJournal here
  // since journal status comes a bit slower, and merging the two causes
  // flakes on our perception of overall upload status.

  // Filter out folder paths.
  const filePaths = [...uploads.syncingPaths].filter(
    path => Constants.getPathItem(pathItems, path).type !== Types.PathType.Folder
  )

  return {
    // We just use syncingPaths rather than merging with writingToJournal here
    // since journal status comes a bit slower, and merging the two causes
    // flakes on our perception of overall upload status.
    endEstimate: enableDebugUploadBanner ? (uploads.endEstimate || 0) + 32000 : uploads.endEstimate || 0,
    fileName:
      filePaths.length === 1
        ? Types.getPathName((filePaths[1] as Types.Path) || Types.stringToPath(''))
        : null,
    files: filePaths.length,
    totalSyncingBytes: uploads.totalSyncingBytes,
  }
}

const mergeProps = ({_kbfsDaemonStatus, _pathItems, _uploads}, {debugToggleShow}) =>
  ({
    ...uploadsToUploadCountdownHOCProps(_pathItems, _uploads),
    debugToggleShow,
    isOnline:
      !flags.kbfsOfflineMode || _kbfsDaemonStatus.onlineStatus !== Types.KbfsDaemonOnlineStatus.Offline,
  } as UploadCountdownHOCProps)

export default compose(
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedUpload'),
  UploadCountdownHOC
)((props: UploadProps) => {
  Kbfs.useFsJournalStatus()
  return <Upload {...props} />
})
