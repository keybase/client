// @flow
import RenderError from './index.render'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux'

export default connect(
  null,
  (dispatch, {routeProps: {error}}) => ({
    onBack: () => dispatch(Creators.onBack()),
    error: error,
  })
)(RenderError)
