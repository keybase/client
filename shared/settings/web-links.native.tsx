import {HeaderHoc, NativeWebView} from '../common-adapters/mobile.native'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'

type OwnProps = Container.RouteProps<{source: string; title: string}>

const WebLinks = Container.compose(
  Container.connect(
    (_, ownProps: OwnProps) => ({
      source: Container.getRouteProps(ownProps, 'source', ''),
      title: Container.getRouteProps(ownProps, 'title', ''),
    }),
    dispatch => ({onBack: () => dispatch(RouteTreeGen.createNavigateUp())}),
    (s, d, o: OwnProps) => ({...o, ...s, ...d})
  ),
  Container.defaultProps({
    dataDetectorTypes: 'none',
  }),
  HeaderHoc
)(NativeWebView)

export default WebLinks
