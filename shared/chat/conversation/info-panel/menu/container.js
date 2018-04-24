// @flow
import * as Constants from '../../../../constants/teams'
import {createGetTeamOperations, createAddTeamWithChosenChannels} from '../../../../actions/teams-gen'
import {compose, connect, isMobile, lifecycle, type TypedState} from '../../../../util/container'
import {InfoPanelMenu} from '.'
import {navigateAppend, navigateTo, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  const isSmallTeam = routeProps.get('isSmallTeam')
  const yourOperations = Constants.getCanPerform(state, teamname)
  // We can get here without loading canPerform
  const _hasCanPerform = Constants.hasCanPerform(state, teamname)
  const badgeSubscribe = !Constants.isTeamWithChosenChannels(state, teamname)
  return {
    _hasCanPerform,
    badgeSubscribe,
    canAddPeople: yourOperations.manageMembers,
    isSmallTeam,
    memberCount: Constants.getTeamMemberCount(state, teamname),
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routeProps, navigateUp}) => {
  const teamname = routeProps.get('teamname')
  return {
    _loadOperations: () => dispatch(createGetTeamOperations({teamname})),
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
      dispatch(createAddTeamWithChosenChannels({teamname}))
    },
    onViewTeam: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(navigateTo([{selected: 'team', props: {teamname}}], [teamsTab]))
      dispatch(switchTo([teamsTab]))
    },
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      if (!this.props._hasCanPerform) {
        this.props._loadOperations()
      }
    },
  })
)(InfoPanelMenu)
