import * as Constants from '../../../constants/teams'
import Tabs, {OwnProps, Props} from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

export default Container.connect(
  (state, {conversationIDKey, teamID}: OwnProps) => {
    const teamMeta = Constants.getTeamMeta(state, teamID)
    const yourOperations = Constants.getCanPerformByID(state, teamID)

    return {
      admin: yourOperations.manageMembers,
      conversationIDKey,
      error: state.teams.errorInAddToTeam,
      loading: anyWaiting(
        state,
        Constants.teamWaitingKey(teamMeta.teamname),
        Constants.teamTarsWaitingKey(teamMeta.teamname)
      ),
      teamname: teamMeta.teamname,
    }
  },
  () => ({}),
  (stateProps, _, ownProps: OwnProps): Props => {
    return {
      ...ownProps,
      admin: stateProps.admin,
      error: stateProps.error,
      loadBots: () => undefined,
      loading: stateProps.loading,
    }
  }
)(Tabs)
