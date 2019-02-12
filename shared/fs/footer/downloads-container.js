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

const maxNumCards = isMobile ? 1 : 3

const mergeProps = ({_downloads}, {openDownloadFolder}) => {
  const downloadKeys = Array.from(_downloads.filter(download => download.meta.intent === 'none'))
    .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
    .map(([key, download]) => key)
  return ({
    downloadKeys: downloadKeys.slice(0, maxNumCards),
    openDownloadFolder,
    thereAreMore: downloadKeys.length > maxNumCards,
  }: DownloadsProps)
}

export default namedConnect<{||}, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedDownloads'
)(Downloads)
