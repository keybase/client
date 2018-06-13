// @flow
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {fsTab} from '../../../constants/tabs'
import {navigateTo} from '../../../actions/route-tree'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createGetProfile} from '../../../actions/tracker-gen.js'
import {folderNameWithoutUsers} from '../../../util/kbfs'
import Banner from '.'

const mapStateToProps = (state: TypedState, {path}) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _pathItem,
    _username,
    path,
    resetParticipants:
      _pathItem.type === 'folder' && _pathItem.tlfMeta ? _pathItem.tlfMeta.resetParticipants : [],
    _teamId: _pathItem.type === 'folder' && _pathItem.tlfMeta ? _pathItem.tlfMeta.teamId : '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onReAddToTeam: (id: RPCTypes.TeamID, username: string) =>
    dispatch(FsGen.createLetResetUserBackIn({id, username})),
  _onOpenWithoutResetUsers: (currPath: Types.Path, users: {[string]: boolean}) => {
    const pathElems = Types.getPathElements(currPath)
    if (pathElems.length < 3) return
    const filteredPathName = folderNameWithoutUsers(pathElems[2], users)
    const filteredPath = Types.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
    return dispatch(navigateTo([fsTab, {props: {path: filteredPath}, selected: 'folder'}]))
  },
  onViewProfile: (username: string) => () =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, {_onReAddToTeam, _onOpenWithoutResetUsers, onViewProfile}) => {
  const resetParticipants = stateProps.resetParticipants.map(i => i.username)
  return {
    isUserReset: resetParticipants.includes(stateProps._username),
    onReAddToTeam: (username: string) => () =>
      stateProps._teamId ? _onReAddToTeam(stateProps._teamId, username) : undefined,
    onOpenWithoutResetUsers: () =>
      _onOpenWithoutResetUsers(
        stateProps.path,
        resetParticipants.reduce((acc, i) => {
          acc[i] = true
          return acc
        }, {})
      ),
    onViewProfile,
    path: stateProps.path,
    resetParticipants,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ResetBanner')
)(Banner)
