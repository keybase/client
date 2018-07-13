// @flow
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import Downloads, {type DownloadsProps} from './downloads'
import {isMobile} from '../../constants/platform'

const mapStateToProps = (state: TypedState) => ({
  _downloads: state.fs.downloads,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  openDownloadFolder: isMobile ? undefined : () => dispatch(FsGen.createOpenInFileUI({})),
})

const mergeProps = ({_downloads}, {openDownloadFolder}) =>
  ({
    downloadKeys: Array.from(_downloads.filter(download => download.meta.intent === 'none'))
      .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
      .map(([key, download]) => key),
    openDownloadFolder,
  }: DownloadsProps)

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedDownloads')
)(Downloads)
