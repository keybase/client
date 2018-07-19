// @flow
import SearchResultRow, {type Props} from '.'
import {userIsActiveInTeamHelper} from '../../constants/teams'
import {followStateHelper, makeSearchResult} from '../../constants/search'
import {type SearchResultId} from '../../constants/types/search'
import {connect, type TypedState, setDisplayName, compose} from '../../util/container'

export type OwnProps = {|
  disableIfInTeamName: ?string,
  id: SearchResultId,
  selected: boolean,
  onClick: () => void,
  onMouseOver?: () => void,
  onShowTracker?: () => void,
|}

const emptySearch = makeSearchResult()

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const result = state.entities.search.searchResults.get(ownProps.id, emptySearch)
  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)
  const leftIsInTeam = userIsActiveInTeamHelper(
    state,
    result.leftUsername,
    result.leftService,
    ownProps.disableIfInTeamName
  )
  const rightIsInTeam = userIsActiveInTeamHelper(
    state,
    result.rightUsername,
    result.rightService,
    ownProps.disableIfInTeamName
  )
  return {
    result,
    leftFollowingState,
    rightFollowingState,
    userIsInTeam: leftIsInTeam || rightIsInTeam,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => {
  const result = stateProps.result.toObject()
  return {
    ...result,
    leftFollowingState: stateProps.leftFollowingState,
    rightFollowingState: stateProps.rightFollowingState,
    userIsInTeam: stateProps.userIsInTeam,
    ...ownProps,
  }
}

export default compose(connect(mapStateToProps, null, mergeProps), setDisplayName('SearchResultRow'))(
  SearchResultRow
)
