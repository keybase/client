// @flow
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import Downloads, {type DownloadsProps} from './downloads'
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

const mergeProps = ({_downloads}, {openDownloadFolder}) => {
  const downloadKeys = Array.from(_downloads.filter(download => download.meta.intent === 'none'))
    .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
    .map(([key, download]) => key)
  return ({
    downloadKeys,
    openDownloadFolder,
  }: DownloadsProps)
}

export default namedConnect<{||}, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedDownloads'
)(Downloads)
