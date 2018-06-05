// @flow
import * as Constants from '../../constants/fs'
import * as TeamTypes from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Banner from '.'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    isUserReset: pathItem.type === 'folder' && pathItem.resetParticipants ? pathItem.resetParticipants.includes(_username) : false,
    resetParticipants: pathItem.type === 'folder'
      ? pathItem.resetParticipants
      : [],
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onReAddToTeam: (teamname: string, username: string, role: TeamTypes.TeamRoleType) => {
    dispatch(
      TeamsGen.createAddToTeam({
        role: role,
        sendChatNotification: false,
        teamname,
        username,
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('ResetBanner'))(
  Banner
)
