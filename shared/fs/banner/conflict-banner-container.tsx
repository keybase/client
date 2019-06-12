import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as SettingsConstants from '../../constants/settings'
import * as FsGen from '../../actions/fs-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import ConflictBanner, {Props} from './conflict-banner'
import openUrl from '../../util/open-url'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
})
type DispatchProps = {
  onFeedback: () => void
  onFinishResolving: () => void
  onHelp: () => void
  onSeeOtherView: () => void
  onStartResolving: () => void
}
const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
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
  onFinishResolving: () => {},
  onHelp: () => openUrl('https://keybase.io/docs/kbfs/understanding_kbfs#conflict_resolution'),
  onSeeOtherView: () => {},
  onStartResolving: () => dispatch(FsGen.createStartManualConflictResolution({tlfPath: ownProps.path})),
})

const mergeProps = (s, d, o: OwnProps) => ({
  ...d,
  conflictState: s._tlf.conflict.state,
  isUnmergedView: Constants.isUnmergedView(o.path),
  tlfPath: Constants.getTlfPath(o.path),
})

const ConnectedBanner = namedConnect<OwnProps, {}, DispatchProps, Props, {}>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConflictBanner'
)(ConflictBanner)

export default ConnectedBanner
