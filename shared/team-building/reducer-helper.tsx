import type * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'

export function teamBuilderReducerCreator<State>(
  callback: (draftState: Container.Draft<State>, action: TeamBuildingGen.Actions) => void
) {
  const allActions = [
    // Note: NO RESET store. That's handled differently so we don't accidentally not get called
    TeamBuildingGen.addUsersToTeamSoFar,
    TeamBuildingGen.cancelTeamBuilding,
    TeamBuildingGen.changeSendNotification,
    TeamBuildingGen.fetchUserRecs,
    TeamBuildingGen.fetchedUserRecs,
    TeamBuildingGen.finishTeamBuilding,
    TeamBuildingGen.setError,
    TeamBuildingGen.finishedTeamBuilding,
    TeamBuildingGen.labelsSeen,
    TeamBuildingGen.removeUsersFromTeamSoFar,
    TeamBuildingGen.search,
    TeamBuildingGen.searchResultsLoaded,
    TeamBuildingGen.selectRole,
    TeamBuildingGen.tbResetStore,
  ] as const

  const teamActions = allActions.reduce<Container.ActionHandler<TeamBuildingGen.Actions, State>>(
    (arr, action) => {
      arr[action] = callback
      return arr
    },
    {}
  )

  return teamActions
}
