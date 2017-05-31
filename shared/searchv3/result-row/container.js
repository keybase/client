// @flow
import {connect} from 'react-redux'
import SearchResultRow from '.'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {id, keyPath}: {id: string, keyPath: Array<string>}) => {
  return {
    // $FlowIssue doesnt like getIn
    ...state.entities.getIn(keyPath.concat([id])),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {keyPath, id}) => ({
  onShowTracker: () => {
    console.log('todo: dispatch action')
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SearchResultRow)
