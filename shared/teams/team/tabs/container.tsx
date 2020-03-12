import * as BotsGen from '../../../actions/bots-gen'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import Tabs from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamID: Types.TeamID
  selectedTab: Types.TabKey
  setSelectedTab: (tab: Types.TabKey) => void
}

export default Container.connect(
  (state, {teamID, selectedTab, setSelectedTab}: OwnProps) => {
    const teamMeta = Constants.getTeamMeta(state, teamID)
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const yourOperations = Constants.getCanPerformByID(state, teamID)

    const _featuredBotsMap = state.chat2.featuredBotsMap
    const _members = teamDetails.members
    return {
      _featuredBotsMap,
      _members,
      admin: yourOperations.manageMembers,
      error: state.teams.errorInAddToTeam,
      isBig: Constants.isBigTeam(state, teamID),
      loading: anyWaiting(
        state,
        Constants.teamWaitingKey(teamMeta.teamname),
        Constants.teamTarsWaitingKey(teamMeta.teamname)
      ),
      newTeamRequests: state.teams.newTeamRequests,
      numInvites: teamDetails.invites?.size ?? 0,
      numRequests: teamDetails.requests?.size ?? 0,
      numSubteams: teamDetails.subteams?.size ?? 0,
      resetUserCount: Constants.getTeamResetUsers(state, teamMeta.teamname).size,
      selectedTab,
      setSelectedTab,
      showSubteams: yourOperations.manageSubteams,
      teamname: teamMeta.teamname,
    }
  },
  dispatch => ({
    _searchFeaturedBot: (query: string) => dispatch(BotsGen.createSearchFeaturedBots({query})),
  }),
  (stateProps, dispatchProps, ownProps) => {
    const _bots = [...(stateProps._members?.values() ?? [])].filter(
      m => m.type === 'restrictedbot' || m.type === 'bot'
    )
    return {
      admin: stateProps.admin,
      error: stateProps.error,
      isBig: stateProps.isBig,
      loadBots: () =>
        _bots.map(
          bot =>
            !stateProps._featuredBotsMap.has(bot.username) && dispatchProps._searchFeaturedBot(bot.username)
        ),
      loading: stateProps.loading,
      newRequests: stateProps.newTeamRequests.get(ownProps.teamID) || 0,
      numInvites: stateProps.numInvites,
      numRequests: stateProps.numRequests,
      numSubteams: stateProps.numSubteams,
      resetUserCount: stateProps.resetUserCount,
      selectedTab: stateProps.selectedTab,
      setSelectedTab: stateProps.setSelectedTab,
      showSubteams: stateProps.showSubteams,
    }
  }
)(Tabs)
