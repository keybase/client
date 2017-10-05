// @flow
import RenderError from '.'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux'

const mapDispatchToProps = (dispatch, {routeProps: {error}}) => ({
  onBack: () => dispatch(Creators.onBack()),
  error: error,
})

export default connect(null, mapDispatchToProps)(RenderError)
