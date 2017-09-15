// @flow
import NewRepo from '.'
// import * as I from 'immutable'
// import * as Constants from '../constants/git'
// import * as Creators from '../actions/git/creators'
// import {compose, lifecycle, mapProps, withState, withHandlers} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => null

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp}) => ({
  onClose: () => dispatch(navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(NewRepo)
