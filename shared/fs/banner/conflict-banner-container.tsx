import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'
import ConflictBanner from './conflict-banner'
import openUrl from '../../util/open-url'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state: Container.TypedState): any => ({})
const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onFeedback: () => {},
  onFinishResolving: () => {},
  onHelp: () => openUrl('https://keybase.io/docs/kbfs/understanding_kbfs#conflict_resolution'),
  onSeeOtherView: () => {},
  onStartResolving: () => dispatch(FsGen.createStartManualConflictResolution({tlfPath: ownProps.path})),
})

const ConnectedBanner = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({
    ...d,
    conflictState: s._tlf.conflict.state,
    isUnmergedView: Constants.isUnmergedView(o.path),
    tlfName: s._tlf.name,
  }),
  'ConflictBanner'
)(ConflictBanner)

export default ConnectedBanner
