// @flow
import SystemInviteAccepted from '.'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import * as Route from '../../../../actions/route-tree'
import {getMeta} from '../../../../constants/chat2/'
import {teamsTab} from '../../../../constants/tabs'
import {connect, type TypedState, isMobile} from '../../../../util/container'

const mapStateToProps = (state: TypedState, ownProps) => ({
  teamname: getMeta(state, ownProps.message.conversationIDKey).teamname,
  you: state.config.username,
})

const mapDispatchToProps = (dispatch) => ({
  onClickUserAvatar: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onViewTeam: (teamname: string) => {
    dispatch(Route.navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
    dispatch(Route.setRouteState([teamsTab, 'team'], {selectedTab: 'members'}))
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(SystemInviteAccepted)
