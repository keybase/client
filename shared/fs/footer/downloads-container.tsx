import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import Downloads from './downloads'
import {isMobile} from '../../constants/platform'
import {downloadFolder} from '../../util/file'

export default Container.namedConnect(
  state => ({_downloads: state.fs.downloads}),
  dispatch => ({
    openDownloadFolder: isMobile
      ? undefined
      : () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadFolder})),
  }),
  ({_downloads}, {openDownloadFolder}) => {
    const downloadKeys = Array.from(
      _downloads.filter(download => download.meta.intent === Types.DownloadIntent.None)
    )
      .sort(([_a, a], [_b, b]) => {
        if (a.state.isDone !== b.state.isDone) {
          return a.state.isDone ? -1 : 1
        } // completed first
        return b.state.startedAt - a.state.startedAt // newer first
      })
      .map(([key]) => key)
    return {downloadKeys, openDownloadFolder}
  },
  'ConnectedDownloads'
)(Downloads)
