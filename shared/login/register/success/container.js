// @flow
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'
import RenderSuccess from '../../signup/success/index.render'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'

// type OwnProps = {
// routeProps: {
// paperkey: HiddenString,
// title: string,
// waiting: boolean,
// },
// }

const mapStateToProps = (s: TypedState, {routeProps}) => ({
  paperkey: routeProps.get('paperkey'),
  title: routeProps.get('title'),
  waiting: routeProps.get('waiting'),
})

const mapDispatchToProps = dispatch => ({
  onFinish: () => dispatch(Creators.onFinish()),
  onBack: () => dispatch(Creators.onBack()),
})

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps)(RenderSuccess)
