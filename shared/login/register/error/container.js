// @flow
import RenderError from '.'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux-profiled'

const mapDispatchToProps = (dispatch, {routeProps: {error}}) => ({
  onBack: () => dispatch(Creators.onBack()),
  error: error,
})

// $FlowIssue
export default connect(null, mapDispatchToProps)(RenderError)
