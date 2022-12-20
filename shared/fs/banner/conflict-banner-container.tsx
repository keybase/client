import * as Constants from '../../constants/fs'
import type * as Types from '../../constants/types/fs'
import * as SettingsConstants from '../../constants/settings'
import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ConflictBanner from './conflict-banner'
import openUrl from '../../util/open-url'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onFeedback: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {feedback: `Conflict Resolution failed in \`${ownProps.path}\`.\n`},
            selected: SettingsConstants.feedbackTab,
          },
        ],
      })
    ),
  onFinishResolving: () =>
    dispatch(FsGen.createFinishManualConflictResolution({localViewTlfPath: ownProps.path})),
  onGoToSamePathInDifferentTlf: (tlfPath: Types.Path) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {props: {path: Constants.rebasePathToDifferentTlf(ownProps.path, tlfPath)}, selected: 'fsRoot'},
        ],
      })
    ),
  onHelp: () => openUrl('https://book.keybase.io/docs/files/details#conflict-resolution'),
  onStartResolving: () => dispatch(FsGen.createStartManualConflictResolution({tlfPath: ownProps.path})),
  openInSystemFileManager: (path: Types.Path) => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const ConnectedBanner = Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...d,
  conflictState: s._tlf.conflictState,
  tlfPath: Constants.getTlfPath(o.path),
}))(ConflictBanner)

export default ConnectedBanner
