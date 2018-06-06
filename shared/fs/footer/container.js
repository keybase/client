// @flow
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import Footer, {type FooterProps} from './footer'
import * as FsGen from '../../actions/fs-gen'
import {formatDurationFromNowTo} from '../../util/timestamp'

const mapStateToProps = (state: TypedState) => ({
  transfers: state.fs.transfers,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  opener: (p: Types.LocalPath) => dispatch(FsGen.createOpenInFileUI({path: p})),
  dismisser: (key: string) => dispatch(FsGen.createDismissTransfer({key})),
  canceler: (key: string) => dispatch(FsGen.createCancelTransfer({key})),
})

const mergeProps = (stateProps, {opener, dismisser, canceler}, ownProps) =>
  ({
    downloads: Array.from(
      stateProps.transfers.filter(
        transfer => transfer.meta.type === 'download' && transfer.meta.intent === 'none'
      )
    )
      .sort(([_a, a], [_b, b]) => b.state.startedAt - a.state.startedAt) // newer first
      .map(([key, transfer]) => ({
        error: transfer.state.error,
        filename: Types.getLocalPathName(transfer.meta.localPath),
        completePortion: transfer.state.completePortion,
        progressText: formatDurationFromNowTo(transfer.state.endEstimate),
        isDone: transfer.state.isDone,
        open: transfer.state.isDone ? () => opener(transfer.meta.localPath) : undefined,
        dismiss: () => dismisser(key),
        cancel: () => canceler(key),
        key,
      })),
    // TODO: add uploadsk
  }: FooterProps)

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('Footer')
)(Footer)
