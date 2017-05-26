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

// TODO
const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SearchResultRow)
