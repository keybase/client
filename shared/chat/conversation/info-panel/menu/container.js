// @flow
import * as Constants from '../../../../constants/teams'
import {connect, isMobile, type TypedState} from '../../../../util/container'
import {InfoPanelMenu} from '.'
import {navigateAppend, navigateTo, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  const isSmallTeam = routeProps.get('isSmallTeam')
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canAddPeople: yourOperations.manageMembers,
    isSmallTeam,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => {
  const teamname = routeProps.get('teamname')
  return {
    onAddPeople: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(
        navigateTo(
          [{selected: 'team', props: {teamname}}, {selected: 'addPeople', props: {teamname}}],
          [teamsTab]
        )
      )
      dispatch(switchTo([teamsTab]))
    },
    onClose: () => {
      dispatch(navigateUp())
    },
    onInvite: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(
        navigateTo(
          [{selected: 'team', props: {teamname}}, {selected: 'inviteByEmail', props: {teamname}}],
          [teamsTab]
        )
      )
      dispatch(switchTo([teamsTab]))
    },
    onLeaveTeam: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(navigateAppend([{selected: 'reallyLeaveTeam', props: {teamname}}]))
    },
    onManageChannels: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(navigateAppend([{selected: 'manageChannels', props: {teamname}}]))
    },
    onViewTeam: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(navigateTo([{selected: 'team', props: {teamname}}], [teamsTab]))
      dispatch(switchTo([teamsTab]))
    },
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(InfoPanelMenu)
