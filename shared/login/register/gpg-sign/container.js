// @flow
import GPGSign from '.'
import {connect} from 'react-redux-profiled'
import * as Creators from '../../../actions/login/creators'

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: exportKey => dispatch(Creators.chooseGPGMethod(exportKey)),
})
// $FlowIssue
export default connect(null, mapDispatchToProps)(GPGSign)
