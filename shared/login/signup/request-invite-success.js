// @flow
import * as Creators from '../../actions/signup'
import Render from './request-invite-success.render'
import {connect} from '../../util/container'

const mapStateToProps = state => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(Creators.restartSignup()),
})
export default connect(mapStateToProps, mapDispatchToProps)(Render)
