// @flow
import {HeaderHoc, NativeWebView} from '../common-adapters/mobile.native'
import {connect, compose, defaultProps, type RouteProps} from '../util/container'

type OwnProps = RouteProps<{source: string, title: string}, {}>

const mapStateToProps = (state, {routeProps}) => ({
  source: routeProps.get('source'),
  title: routeProps.get('title'),
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const WebLinks = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  defaultProps({
    dataDetectorTypes: 'none',
  }),
  HeaderHoc
)(NativeWebView)

export default WebLinks
