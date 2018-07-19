// @flow
import SearchResultRow from '.'
import {Map} from 'immutable'
import {userIsActiveInTeamHelper} from '../../constants/teams'
import {followStateHelper} from '../../constants/search'
import {type SearchResultId} from '../../constants/types/search'
import {connect, type TypedState, setDisplayName, compose} from '../../util/container'

export type OwnProps = {
  disableIfInTeamName: ?string,
  id: SearchResultId,
  onClick: () => void,
  onMouseOver?: () => void,
  onShowTracker?: () => void,
}

const mapStateToProps = (
  state: TypedState,
  {disableIfInTeamName, id, onClick, onMouseOver, onShowTracker}: OwnProps
) => {
  const result: any = state.entities.getIn(['search', 'searchResults', id], Map()).toObject()
  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)
  const leftIsInTeam = disableIfInTeamName
    ? userIsActiveInTeamHelper(state, result.leftUsername, result.leftService, disableIfInTeamName)
    : false
  const rightIsInTeam = disableIfInTeamName
    ? userIsActiveInTeamHelper(state, result.rightUsername, result.rightService, disableIfInTeamName)
    : false
  return {
    ...result,
    onClick,
    onMouseOver,
    onShowTracker,
    showTrackerButton: !!onShowTracker,
    leftFollowingState,
    rightFollowingState,
    userIsInTeam: leftIsInTeam || rightIsInTeam,
  }
}

export default compose(connect(mapStateToProps), setDisplayName('SearchResultRow'))(SearchResultRow)
