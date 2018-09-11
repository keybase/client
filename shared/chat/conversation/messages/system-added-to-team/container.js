// @flow
import * as RouteTree from '../../../../actions/route-tree'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import {getMeta} from '../../../../constants/chat2/'
import {getRole, isAdmin} from '../../../../constants/teams'
import SystemAddedToTeam from '.'
import {teamsTab} from '../../../../constants/tabs'
import {connect, type TypedState, isMobile} from '../../../../util/container'

const mapStateToProps = (state: TypedState, ownProps) => {
  const teamname = getMeta(state, ownProps.message.conversationIDKey).teamname
  return {
    isAdmin: isAdmin(getRole(state, teamname)),
    teamname,
    you: state.config.username || '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) =>
    dispatch(RouteTree.navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onViewTeam: (teamname: string) => {
    dispatch(RouteTree.setRouteState([teamsTab, 'team'], {selectedTab: 'members'}))
    dispatch(RouteTree.navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
  },
  onClickUserAvatar: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isAdmin: stateProps.isAdmin,
  message: ownProps.message,
  onClickUserAvatar: dispatchProps.onClickUserAvatar,
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
  teamname: stateProps.teamname,
  you: stateProps.you,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SystemAddedToTeam)
