// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {namedConnect} from '../../util/container'
import ConflictBanner from './conflict-banner'
import openUrl from '../../util/open-url'

type OwnProps = {|path: Types.Path|}

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch, ownProps) => ({
  onFeedback: () => {},
  onFinishResolving: () => {},
  onHelp: () => openUrl('https://keybase.io/docs/kbfs/understanding_kbfs#conflict_resolution'),
  onSeeOtherView: () => {},
  onStartResolving: () => dispatch(FsGen.createStartManualConflictResolution({tlfPath: ownProps.path})),
})

const mergeProps = (s, d, o) => ({
  ...d,
  conflictState: s._tlf.conflict.state,
  isUnmergedView: Constants.isUnmergedView(o.path),
  tlfName: s._tlf.name,
})

const ConnectedBanner = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConflictBanner'
)(ConflictBanner)

export default ConnectedBanner
