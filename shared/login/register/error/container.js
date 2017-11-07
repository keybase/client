// @flow
import * as LoginGen from '../../../actions/login-gen'
import RenderError from '.'
import {connect} from 'react-redux'

const mapDispatchToProps = (dispatch, {routeProps}) => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  error: routeProps.get('error'),
})

export default connect(null, mapDispatchToProps)(RenderError)
