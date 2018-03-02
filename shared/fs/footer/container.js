// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import Footer, {type FooterProps} from './footer'
import * as FsGen from '../../actions/fs-gen'

type StateProps = {
  transfers: I.Map<string, Types.TransferState>,
}

type OwnProps = {}

type actionFactory = (p: Types.LocalPath) => () => void
type DispatchProps = {
  opener: actionFactory,
  dismisser: actionFactory,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  transfers: state.fs.transfers,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  opener: (p: Types.LocalPath) => () =>
    dispatch(
      FsGen.createOpenLocalPathInFolder({
        localPath: p,
      })
    ),
  dismisser: (key: string) => () => dispatch(FsGen.createDismissTransfer({key})),
})

const mergeProps = (stateProps: StateProps, {opener, dismisser}: DispatchProps, ownProps) =>
  ({
    downloads: Array.from(stateProps.transfers.filter(transferState => transferState.type === 'download'))
      .sort(([_a, a], [_b, b]) => b.startedAt - a.startedAt) // newer first
      .map(([key, transferState]) => ({
        filename: Types.getLocalPathName(transferState.localPath),
        completePortion: transferState.completePortion,
        progressText: Math.round((1 - transferState.completePortion) * 4).toString() + ' s', // TODO: fix this when we have real estimate
        isDone: transferState.isDone,
        open: opener(transferState.localPath),
        dismiss: dismisser(key),
        key: key,
      })),
    // TODO: add uploadsk
  }: FooterProps)

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FsFooter'))(
  Footer
)
