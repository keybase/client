// @flow
import SystemInviteAccepted from '.'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import * as Route from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {connect, type TypedState, isMobile, type Dispatch} from '../../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  you: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClickUserAvatar: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onViewTeam: (teamname: string) => {
    dispatch(Route.navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
    dispatch(Route.setRouteState([teamsTab, 'team'], {selectedTab: 'members'}))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(SystemInviteAccepted)
