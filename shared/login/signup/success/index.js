// @flow
import RenderSuccess from './index.render'
import {connect} from 'react-redux'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'

type OwnProps = any

export default connect(
  (state: any, {routeProps}: OwnProps) => ({
    paperkey: state.signup.paperkey,
    waiting: state.signup.waiting,
    ...routeProps,
  }),
  (dispatch, {routeProps}: OwnProps) => ({
    onFinish: routeProps.onFinish ? routeProps.onFinish : () => { dispatch(sawPaperKey()) },
    onBack: routeProps.onBack ? routeProps.onBack : () => { dispatch(navigateUp()) },
  })
)(RenderSuccess)
