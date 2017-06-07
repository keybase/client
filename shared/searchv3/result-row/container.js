// @flow
import {connect} from 'react-redux'
import SearchResultRow from '.'

import type {TypedState} from '../../constants/reducer'
import type {SearchResultId} from '../../constants/searchv3'

const mapStateToProps = (
  state: TypedState,
  {id, onClick, onShowTracker}: {id: SearchResultId, onClick: () => void, onShowTracker: () => void}
) => {
  return {
    // $FlowIssue doesn't understand getIn
    ...state.entities.getIn(['searchResults', id]).toObject(),
    onClick,
    onShowTracker,
  }
}

export default connect(mapStateToProps)(SearchResultRow)
