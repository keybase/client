// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Download, {type DownloadProps} from './download'
import * as FsGen from '../../actions/fs-gen'
import {formatDurationFromNowTo} from '../../util/timestamp'

type OwnProps = {
  downloadKey: string,
}

const mapStateToProps = (state, {downloadKey}: OwnProps) => ({
  _download: state.fs.downloads.get(downloadKey, Constants.makeDownload()),
})

const mapDispatchToProps = dispatch => ({
  _canceler: (key: string) => {
    dispatch(FsGen.createCancelDownload({key}))
    dispatch(FsGen.createDismissDownload({key}))
  },
  _dismisser: (key: string) => dispatch(FsGen.createDismissDownload({key})),
  _opener: (p: Types.LocalPath) => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: p})),
})

const mergeProps = ({_download}, {_opener, _dismisser, _canceler}, {downloadKey}) =>
  ({
    cancel: () => _canceler(downloadKey),
    completePortion: _download.state.completePortion,
    dismiss: () => _dismisser(downloadKey),
    error: _download.state.error,
    filename: Types.getLocalPathName(_download.meta.localPath),
    isDone: _download.state.isDone,
    open: _download.state.isDone ? () => _opener(_download.meta.localPath) : undefined,
    progressText: formatDurationFromNowTo(_download.state.endEstimate),
  }: DownloadProps)

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedDownload'
)(Download)
