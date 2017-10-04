// @flow
import SearchResultRow from '.'
import {Map} from 'immutable'
import {connect, type MapStateToProps} from 'react-redux'
import {followStateHelper, type SearchResultId} from '../../constants/search'
import {type TypedState} from '../../constants/reducer'

const mapStateToProps: MapStateToProps<*, *, *> = (
  state: TypedState,
  {
    id,
    onClick,
    onMouseOver,
    onShowTracker,
  }: {id: SearchResultId, onClick: () => void, onMouseOver: () => void, onShowTracker: () => void}
) => {
  const result = state.entities.getIn(['searchResults', id], Map()).toObject()

  const leftFollowingState = followStateHelper(state, result.leftUsername, result.leftService)
  const rightFollowingState = followStateHelper(state, result.rightUsername, result.rightService)

  return {
    ...result,
    onClick,
    onMouseOver,
    onShowTracker,
    showTrackerButton: !!onShowTracker,
    leftFollowingState,
    rightFollowingState,
  }
}

export default connect(mapStateToProps)(SearchResultRow)
