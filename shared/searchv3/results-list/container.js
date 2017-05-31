// @flow
import {connect} from 'react-redux'
import SearchResultsList from '.'

import type {TypedState} from '../../constants/reducer'

// TODO use entities
const mapStateToProps = ({entities}: TypedState) => {
  return {}
}

// TODO
const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(SearchResultsList)
