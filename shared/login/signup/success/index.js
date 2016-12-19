// @flow
import RenderSuccess from './index.render'
import {connect} from 'react-redux'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'

// This component's a bit special.
//
// It's using `state.signup` values when called from the signup path, and
// routeTree state generated from RPC action payloads when called from either
// the provisioning/login path or the "Devices->Add new paper key" path.

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
