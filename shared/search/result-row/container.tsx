import SearchResultRow, {Props} from '.'
import {userIsActiveInTeamHelper} from '../../constants/teams'
import {followStateHelper, getUserInputItemIds, makeSearchResult} from '../../constants/search'
import {SearchResultId} from '../../constants/types/search'
import {parseUserId} from '../../util/platforms'
import {namedConnect} from '../../util/container'
import {some} from 'lodash-es'

export type OwnProps = {
  disableIfInTeamName: string | null
  id: SearchResultId
  selected: boolean
  onClick: () => void
  onMouseOver?: () => void
  onShowTracker?: () => void
  searchKey: string
}

const emptySearch = makeSearchResult()

const mapStateToProps = (state, ownProps: OwnProps) => {
  const result = state.entities.search.searchResults.get(ownProps.id, emptySearch)
  const {searchKey} = ownProps
  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)

  const selectedIds = getUserInputItemIds(state, searchKey)
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
  const userIsInTeam = leftIsInTeam || rightIsInTeam
  return {
    leftFollowingState,
    result,
    rightFollowingState,
    selectedIds,
    userIsInTeam,
  }
}

const mergeProps = (stateProps, _, ownProps: OwnProps): Props => {
  const result = stateProps.result.toObject()
  const parsedIds = stateProps.selectedIds.map(id => parseUserId(id))
  // Check whether the user shown in this row has been chosen in the input box.
  const userAlreadySelected =
    some(parsedIds, {serviceId: (result.leftService || '').toLowerCase(), username: result.leftUsername}) ||
    some(parsedIds, {serviceId: (result.rightService || '').toLowerCase(), username: result.rightUsername})

  let leftFullname = result.leftFullname
  if (leftFullname) {
    if (stateProps.userIsInTeam) {
      leftFullname = leftFullname + ' • '
    }
  }
  if (stateProps.userIsInTeam) {
    leftFullname = (leftFullname || '') + 'Already in team'
  }
  const userIsSelectable = !stateProps.userIsInTeam && !userAlreadySelected

  return {
    ...result,
    leftFollowingState: stateProps.leftFollowingState,
    leftFullname,
    leftIconOpaque: userIsSelectable,
    rightFollowingState: stateProps.rightFollowingState,
    rightIconOpaque: userIsSelectable,
    userAlreadySelected,
    userIsInTeam: stateProps.userIsInTeam,
    userIsSelectable,
    ...ownProps,
  }
}

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'SearchResultRow')(SearchResultRow)
