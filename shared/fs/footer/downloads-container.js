// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import Downloads, {type DownloadsProps} from './downloads'
import {isMobile} from '../../constants/platform'
import {downloadFolder} from '../../util/file'

const mapStateToProps = (state: TypedState) => ({
  _downloads: state.fs.downloads,
})

const mapDispatchToProps = (dispatch) => ({
  openDownloadFolder: isMobile
    ? undefined
    : () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({path: downloadFolder})),
})

const maxNumCards = isMobile ? 1 : 3

const mergeProps = ({_downloads}, {openDownloadFolder}) => {
  const downloadKeys = Array.from(_downloads.filter(download => download.meta.intent === 'none'))
    .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
    .map(([key, download]) => key)
  return ({
    downloadKeys: downloadKeys.slice(0, maxNumCards),
    thereAreMore: downloadKeys.length > maxNumCards,
    openDownloadFolder,
  }: DownloadsProps)
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('ConnectedDownloads')
)(Downloads)
