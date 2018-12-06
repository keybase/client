// @flow
import * as Constants from '../../../constants/fs'
import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'
import {fsTab} from '../../../constants/tabs'
import {navigateTo} from '../../../actions/route-tree'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createGetProfile} from '../../../actions/tracker-gen'
import {folderNameWithoutUsers} from '../../../util/kbfs'
import Banner from '.'

type OwnProps = {|path: Types.Path|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
  _username: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _onOpenWithoutResetUsers: (currPath: Types.Path, users: {[string]: boolean}) => {
    const pathElems = Types.getPathElements(currPath)
    if (pathElems.length < 3) return
    const filteredPathName = folderNameWithoutUsers(pathElems[2], users)
    const filteredPath = Types.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
    return dispatch(navigateTo([fsTab, {props: {path: filteredPath}, selected: 'folder'}]))
  },
  _onReAddToTeam: (id: RPCTypes.TeamID, username: string) =>
    dispatch(FsGen.createLetResetUserBackIn({id, username})),
  onViewProfile: (username: string) => () =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (
  stateProps,
  {_onReAddToTeam, _onOpenWithoutResetUsers, onViewProfile},
  {path}: OwnProps
) => {
  const resetParticipants = stateProps._tlf.resetParticipants.map(i => i.username).toArray()
  return {
    isUserReset: !!stateProps._username && resetParticipants.includes(stateProps._username),
    onOpenWithoutResetUsers: () =>
      _onOpenWithoutResetUsers(
        path,
        resetParticipants.reduce((acc, i: string) => {
          acc[i] = true
          return acc
        }, {})
      ),
    onReAddToTeam: (username: string) => () =>
      stateProps._tlf.teamId ? _onReAddToTeam(stateProps._tlf.teamId, username) : undefined,
    onViewProfile,
    path,
    resetParticipants,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ResetBanner'
)(Banner)
