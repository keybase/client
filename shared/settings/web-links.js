// @flow
import {HeaderHoc, NativeWebView} from '../common-adapters/index.native'
import {connect} from 'react-redux'
import {compose} from 'recompose'

import type {Dispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps: {title, source}}) => ({
  title,
  source,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const WebLinks = compose(
  connect(mapStateToProps, mapDispatchToProps),
  HeaderHoc,
)(NativeWebView)

export default WebLinks
