// @flow
import {HeaderHoc, NativeWebView} from '../common-adapters/index.native'
import {connect, compose, defaultProps, type TypedState} from '../util/container'

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
