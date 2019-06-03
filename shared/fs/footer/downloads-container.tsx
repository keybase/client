import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import Downloads, {DownloadsProps} from './downloads'
import {isMobile} from '../../constants/platform'
import {downloadFolder} from '../../util/file'

const mapStateToProps = state => ({
  _downloads: state.fs.downloads,
})

const mapDispatchToProps = dispatch => ({
  openDownloadFolder: isMobile
    ? undefined
    : () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadFolder})),
})

const mergeProps = ({_downloads}, {openDownloadFolder}): DownloadsProps => {
  const downloadKeys = Array.from(
    _downloads.filter(download => download.meta.intent === Types.DownloadIntent.None)
  )
    .sort(([_a, a], [_b, b]) => {
      if (a.state.isDone !== b.state.isDone) {
        return a.state.isDone ? -1 : 1
      } // completed first
      return b.state.startedAt - a.state.startedAt // newer first
    })
    .map(([key, download]) => key)
  return {
    downloadKeys,
    openDownloadFolder,
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedDownloads')(Downloads)
