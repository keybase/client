// @flow
import RenderGPGSign from './index.render'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/login/creators'

// $FlowIssue
export default connect(null, dispatch => ({
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: exportKey => dispatch(Creators.chooseGPGMethod(exportKey)),
}))(RenderGPGSign)
