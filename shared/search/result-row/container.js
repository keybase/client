// @flow
import SearchResultRow from '.'
import {Map} from 'immutable'
import {followStateHelper, type SearchResultId} from '../../constants/search'
import {connect, type MapStateToProps, type TypedState} from '../../util/container'

const mapStateToProps: MapStateToProps<*, *, *> = (
  state: TypedState,
  {
    id,
    onClick,
    onMouseOver,
    onShowTracker,
  }: {id: SearchResultId, onClick: () => void, onMouseOver?: () => void, onShowTracker?: () => void}
) => {
  const result: any = state.entities.getIn(['search', 'searchResults', id], Map()).toObject()
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
