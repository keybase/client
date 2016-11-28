// @flow
import RenderSuccess from './index.render'
import {connect} from 'react-redux'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'

// $FlowIssue
export default connect(
  state => ({
    paperkey: state.signup.paperkey,
    waiting: state.signup.waiting,
  }),
  dispatch => ({
    onFinish: () => { dispatch(sawPaperKey()) },
    onBack: () => { dispatch(navigateUp()) },
  })
)(RenderSuccess)
