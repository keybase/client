// @flow
import SearchResultRow from '.'
import {Map} from 'immutable'
import {userIsInTeamHelper} from '../../constants/teams'
import {followStateHelper, type SearchResultId} from '../../constants/search'
import {connect, type MapStateToProps, type TypedState} from '../../util/container'

const mapStateToProps: MapStateToProps<*, *, *> = (
  state: TypedState,
  {
    disableIfInTeamName,
    id,
    onClick,
    onMouseOver,
    onShowTracker,
  }: {
    disableIfInTeamName: ?string,
    id: SearchResultId,
    onClick: () => void,
    onMouseOver?: () => void,
    onShowTracker?: () => void,
  }
) => {
  const result: any = state.entities.getIn(['search', 'searchResults', id], Map()).toObject()
  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)
  const leftIsInTeam = disableIfInTeamName
    ? userIsInTeamHelper(state, result.leftUsername, result.leftService, disableIfInTeamName)
    : false
  const rightIsInTeam = disableIfInTeamName
    ? userIsInTeamHelper(state, result.rightUsername, result.rightService, disableIfInTeamName)
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

export default connect(mapStateToProps)(SearchResultRow)
