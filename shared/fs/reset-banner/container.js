// @flow
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Banner from '.'

const mapStateToProps = (state: TypedState, {path}) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _pathItem,
    _username,
    path,
    isUserReset: _pathItem.type === 'folder' && _pathItem.resetParticipants ? _pathItem.resetParticipants.includes(_username) : false,
    resetParticipants: _pathItem.type === 'folder'
      ? _pathItem.resetParticipants
      : [],
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onReAddToTeam: (id: RPCTypes.TeamID, username: string) =>
    dispatch(FsGen.createLetResetUserBackIn({id, username})),
})

const mergeProps = (stateProps, {_onReAddToTeam}) => ({
  ...stateProps,
  onReAddToTeam: (username: string) => () => (stateProps._pathItem.teamID ? _onReAddToTeam(stateProps._pathItem.teamID, username) : undefined),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('ResetBanner'))(
  Banner
)
