// @flow
import {connect} from 'react-redux'
import SearchResultRow from '.'

import type {TypedState} from '../../constants/reducer'

// TODO use entities
const mapStateToProps = (state: TypedState, id: string) => {
  return {}
}

// TODO
const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(SearchResultRow)
