// @flow
import * as LoginGen from '../../../actions/login-gen'
import RenderError from '.'
import {connect, type Dispatch} from '../../../util/container'

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  error: routeProps.get('error'),
})

export default connect(
  null,
  mapDispatchToProps
)(RenderError)
