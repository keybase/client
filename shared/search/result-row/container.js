// @flow
import {Map} from 'immutable'
import {connect} from 'react-redux'
import SearchResultRow from '.'
import {followStateHelper} from '../../constants/search'

import type {TypedState} from '../../constants/reducer'
import type {SearchResultId} from '../../constants/search'

const mapStateToProps = (
  state: TypedState,
  {
    disableIfInTeamName,
    id,
    onClick,
    onMouseOver,
    onShowTracker,
  }: {disableIfInTeamName: ?string, id: SearchResultId, onClick: () => void, onMouseOver: () => void, onShowTracker: () => void}
) => {
  const result = state.entities.getIn(['search', 'searchResults', id], Map()).toObject()
  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)
  //const leftIsInTeam = disableIfInTeamName ? teamMemberStateHelper(state, result.leftUsername, result.leftService, disableIfInTeamName) : false
  //const rightIsInTeam = disableIfInTeamName ? teamMemberStateHelper(state, result.rightUsername, result.rightService, disableIfInTeam) : false
  console.warn('disableIfInTeamName is', disableIfInTeamName)
  //const teamMembers = disableIfInTeamName && entities.getIn(['teams', 'teamNameToMembers', disableIfInTeamName])
  /*  const items = searchResultIds &&
  (disableIfInTeamName ? searchResultIds.toArray().map(item => {
    return [item, teamMembers.filter(elem => elem.username === item).length > 0]
  }) : searchResultIds.toArray().map(item => [item, false]))
  */
  return {
    ...result,
    onClick,
    onMouseOver,
    onShowTracker,
    showTrackerButton: !!onShowTracker,
    leftFollowingState,
    rightFollowingState,
    isInTeam: false,//: leftIsInTeam || rightIsInTeam,
  }
}

export default connect(mapStateToProps)(SearchResultRow)
