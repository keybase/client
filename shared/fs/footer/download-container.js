// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import Download, {type DownloadProps} from './download'
import * as FsGen from '../../actions/fs-gen'
import {formatDurationFromNowTo} from '../../util/timestamp'

type OwnProps = {
  downloadKey: string,
}

const mapStateToProps = (state: TypedState, {downloadKey}: OwnProps) => ({
  _download: state.fs.downloads.get(downloadKey, Constants.makeDownload()),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _opener: (p: Types.LocalPath) => dispatch(FsGen.createOpenInFileUI({path: p})),
  _dismisser: (key: string) => dispatch(FsGen.createDismissDownload({key})),
  _canceler: (key: string) => dispatch(FsGen.createCancelDownload({key})),
})

const mergeProps = ({_download}, {_opener, _dismisser, _canceler}, {downloadKey}) =>
  ({
    error: _download.state.error,
    filename: Types.getLocalPathName(_download.meta.localPath),
    completePortion: _download.state.completePortion,
    progressText: formatDurationFromNowTo(_download.state.endEstimate),
    isDone: _download.state.isDone,
    open: _download.state.isDone ? () => _opener(_download.meta.localPath) : undefined,
    dismiss: () => _dismisser(downloadKey),
    cancel: () => _canceler(downloadKey),
  }: DownloadProps)

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedDownload')
)(Download)
