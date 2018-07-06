// @flow
import SearchResultRow from '.'
import {userIsActiveInTeamHelper} from '../../constants/teams'
import {followStateHelper, makeSearchResult} from '../../constants/search'
import {type SearchResultId} from '../../constants/types/search'
import {connect, type TypedState, setDisplayName, compose} from '../../util/container'

export type OwnProps = {
  disableIfInTeamName: ?string,
  id: SearchResultId,
  selected: boolean,
  onClick: () => void,
  onMouseOver?: () => void,
  onShowTracker?: () => void,
}

const mapStateToProps = (
  state: TypedState,
  {disableIfInTeamName, id, onClick, onMouseOver, onShowTracker}: OwnProps
) => {
  const result = state.entities.search.searchResults.get(id, makeSearchResult()).toObject()
  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)
  const leftIsInTeam = userIsActiveInTeamHelper(
    state,
    result.leftUsername,
    result.leftService,
    disableIfInTeamName
  )
  const rightIsInTeam = userIsActiveInTeamHelper(
    state,
    result.rightUsername,
    result.rightService,
    disableIfInTeamName
  )
  return {
    ...result,
    leftFollowingState,
    rightFollowingState,
    userIsInTeam: leftIsInTeam || rightIsInTeam,
  }
}

export default compose(connect(mapStateToProps), setDisplayName('SearchResultRow'))(SearchResultRow)
