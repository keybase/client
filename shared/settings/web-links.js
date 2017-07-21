// @flow
import {HeaderHoc, NativeWebView} from '../common-adapters/index.native'
import {connect} from 'react-redux-profiled'
import {compose, defaultProps} from 'recompose'

import type {Dispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps: {title, source}}) => ({
  source,
  title,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const WebLinks = compose(
  connect(mapStateToProps, mapDispatchToProps),
  defaultProps({
    dataDetectorTypes: 'none',
  }),
  HeaderHoc
)(NativeWebView)

export default WebLinks
