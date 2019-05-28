import {HeaderHoc, NativeWebView} from '../common-adapters/mobile.native'
import {TypedState} from '../constants/reducer'
import {connect, compose, defaultProps, RouteProps} from '../util/container'

type OwnProps = RouteProps<
  {
    source: string
    title: string
  },
  {}
>

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  source: ownProps.routeProps.get('source'),
  title: ownProps.routeProps.get('title'),
})

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const WebLinks = compose(
  connect(
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
