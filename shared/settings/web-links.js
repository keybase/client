// @flow
import {HeaderHoc, NativeWebView} from '../common-adapters/index.native'
import {connect, compose, defaultProps, type TypedState} from '../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  source: routeProps.get('source'),
  title: routeProps.get('title'),
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
