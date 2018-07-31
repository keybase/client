// @flow
import SearchResultRow, {type Props} from '.'
import {userIsActiveInTeamHelper} from '../../constants/teams'
import {followStateHelper, getUserInputItemIds, makeSearchResult} from '../../constants/search'
import {type SearchResultId} from '../../constants/types/search'
import {parseUserId} from '../../util/platforms'
import {connect, type TypedState, setDisplayName, compose} from '../../util/container'
import {some} from 'lodash-es'

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
  const searchKey = 'addToTeamSearch'
  const selectedIds = getUserInputItemIds(state, {searchKey})
  const parsedIds = selectedIds.map(id => parseUserId(id))
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
  // Check whether the user shown in this row has been chosen in the input box.
  const userAlreadySelected =
    some(parsedIds, {serviceId: (result.leftService || '').toLowerCase(), username: result.leftUsername}) ||
    some(parsedIds, {serviceId: (result.rightService || '').toLowerCase(), username: result.rightUsername})
  const userIsInTeam = leftIsInTeam || rightIsInTeam
  return {
    result,
    leftFollowingState,
    rightFollowingState,
    userAlreadySelected,
    userIsInTeam,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => {
  const result = stateProps.result.toObject()
  const leftFullname = (result.leftFullname || '') + (stateProps.userIsInTeam ? ' • Already in team' : '')
  const avatarsOpaque = !stateProps.userIsInTeam
  return {
    ...result,
    leftFollowingState: stateProps.leftFollowingState,
    leftFullname,
    leftIconOpaque: avatarsOpaque,
    rightFollowingState: stateProps.rightFollowingState,
    rightIconOpaque: avatarsOpaque,
    userAlreadySelected: stateProps.userAlreadySelected,
    userIsInTeam: stateProps.userIsInTeam,
    ...ownProps,
  }
}

export default compose(connect(mapStateToProps, null, mergeProps), setDisplayName('SearchResultRow'))(
  SearchResultRow
)
