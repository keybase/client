// @flow
import RenderError from '.'
import * as Creators from '../../../actions/login/creators'
import {connect} from 'react-redux'

const mapDispatchToProps = (dispatch, {routeProps}) => ({
  onBack: () => dispatch(Creators.onBack()),
  error: routeProps.get('error'),
})

// $FlowIssue
export default connect(null, mapDispatchToProps)(RenderError)
