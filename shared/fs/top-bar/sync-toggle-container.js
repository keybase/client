// @flow
import {namedConnect} from '../../util/container'
import SyncToggle from './sync-toggle'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {|
  tlfPath: Types.Path,
|}

const mapStateToProps = (state, {tlfPath}: OwnProps) => ({
  _tlfs: state.fs.tlfs,
  waiting: anyWaiting(state, Constants.syncToggleWaitingKey),
})

const mapDispatchToProps = (dispatch, {tlfPath}) => ({
  disableSync: () => dispatch(FsGen.createSetTlfSyncConfig({enabled: false, tlfPath})),
  enableSync: () => dispatch(FsGen.createSetTlfSyncConfig({enabled: true, tlfPath})),
})

const mergeProps = (stateProps, dispatchProps, {tlfPath}: OwnProps) => ({
  syncConfig: Constants.getTlfFromPath(stateProps._tlfs, tlfPath).syncConfig,
  waiting: stateProps.waiting,
  ...dispatchProps,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SyncToggle'
)(SyncToggle)
