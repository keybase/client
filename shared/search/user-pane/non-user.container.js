// @flow
import NonUser from './non-user.render'
import {connect} from 'react-redux'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  avatar: routeProps.avatar,
  fullname: routeProps.fullname,
  profileUrl: routeProps.profileUrl,
  serviceName: routeProps.serviceName,
  username: routeProps.username,
  title: routeProps.username,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps): any => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(NonUser)
