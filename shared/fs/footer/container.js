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
})

const mergeProps = (stateProps, {opener, dismisser}, ownProps) =>
  ({
    downloads: Array.from(
      stateProps.transfers.filter(
        transferState => transferState.type === 'download' && transferState.intent === 'none'
      )
    )
      .sort(([_a, a], [_b, b]) => b.startedAt - a.startedAt) // newer first
      .map(([key, transferState]) => ({
        filename: Types.getLocalPathName(transferState.localPath),
        completePortion: transferState.completePortion,
        progressText: formatDurationFromNowTo(transferState.endEstimate),
        isDone: transferState.isDone,
        open: transferState.isDone ? () => opener(transferState.localPath) : undefined,
        dismiss: () => dismisser(key),
        key,
      })),
    // TODO: add uploadsk
  }: FooterProps)

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Footer'))(
  Footer
)
