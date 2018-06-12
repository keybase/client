// @flow
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createGetProfile} from '../../../actions/tracker-gen.js'
import Banner from '.'

const mapStateToProps = (state: TypedState, {path}) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _pathItem,
    _username,
    path,
    resetParticipants: _pathItem.type === 'folder' && _pathItem.tlfMeta ? _pathItem.tlfMeta.resetParticipants : [],
    _teamId: _pathItem.type === 'folder' && _pathItem.tlfMeta ? _pathItem.tlfMeta.teamId : '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onReAddToTeam: (id: RPCTypes.TeamID, username: string) =>
    dispatch(FsGen.createLetResetUserBackIn({id, username})),
  onViewProfile: (username: string) => () =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, {_onReAddToTeam, onViewProfile}) => ({
  isUserReset: stateProps.resetParticipants.length > 0
    ? stateProps.resetParticipants.includes(stateProps._username)
    : false,
  onReAddToTeam: (username: string) => () =>
    stateProps._teamId ? _onReAddToTeam(stateProps._teamId, username) : undefined,
  onViewProfile,
  path: stateProps.path,
  resetParticipants: stateProps.resetParticipants.map(i => i.username),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ResetBanner')
)(Banner)
