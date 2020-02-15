import * as BotsGen from '../../../actions/bots-gen'
import * as Constants from '../../../constants/teams'
import Tabs, {OwnProps, Props} from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const teamMeta = Constants.getTeamMeta(state, teamID)
    // TODO: uncomment when building the bots tab.
    // const teamDetails = Constants.getTeamDetails(state, teamID)
    const yourOperations = Constants.getCanPerformByID(state, teamID)

    // TODO: uncomment when building the bots tab.
    // const _featuredBotsMap = state.chat2.featuredBotsMap
    // const _members = teamDetails.members
    return {
      // TODO: uncomment when building the bots tab.
      // _featuredBotsMap,
      // _members,
      admin: yourOperations.manageMembers,
      error: state.teams.errorInAddToTeam,
      loading: anyWaiting(
        state,
        Constants.teamWaitingKey(teamMeta.teamname),
        Constants.teamTarsWaitingKey(teamMeta.teamname)
      ),
      teamname: teamMeta.teamname,
    }
  },
  dispatch => ({
    _searchFeaturedBot: (query: string) => dispatch(BotsGen.createSearchFeaturedBots({query})),
  }),
  (stateProps, _, ownProps: OwnProps): Props => {
    // TODO: uncomment when building the bots tab.
    // const _bots = [...(stateProps._members?.values() ?? [])].filter(
    //   m => m.type === 'restrictedbot' || m.type === 'bot'
    // )
    return {
      ...ownProps,
      admin: stateProps.admin,
      error: stateProps.error,
      loadBots: () => undefined,
      // TODO: uncomment when building the bots tab.
      // loadBots: () =>
      //   _bots.map(
      //     bot =>
      //       !stateProps._featuredBotsMap.has(bot.username) && dispatchProps._searchFeaturedBot(bot.username)
      //   ),
      loading: stateProps.loading,
    }
  }
)(Tabs)
