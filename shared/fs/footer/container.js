// @flow
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import Footer, {type FooterProps} from './footer'
import * as FsGen from '../../actions/fs-gen'
import {formatDurationFromNowTo} from '../../util/timestamp'

const mapStateToProps = (state: TypedState) => ({
  downloads: state.fs.downloads,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  opener: (p: Types.LocalPath) => dispatch(FsGen.createOpenInFileUI({path: p})),
  dismisser: (key: string) => dispatch(FsGen.createDismissDownload({key})),
  canceler: (key: string) => dispatch(FsGen.createCancelDownload({key})),
})

const mergeProps = (stateProps, {opener, dismisser, canceler}, ownProps) =>
  ({
    downloads: Array.from(stateProps.downloads.filter(download => download.meta.intent === 'none'))
      .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
      .map(([key, download]) => ({
        error: download.state.error,
        filename: Types.getLocalPathName(download.meta.localPath),
        completePortion: download.state.completePortion,
        progressText: formatDurationFromNowTo(download.state.endEstimate),
        isDone: download.state.isDone,
        open: download.state.isDone ? () => opener(download.meta.localPath) : undefined,
        dismiss: () => dismisser(key),
        cancel: () => canceler(key),
        key,
      })),
    // TODO: add uploadsk
  }: FooterProps)

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Footer'))(
  Footer
)
