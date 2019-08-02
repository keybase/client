import Screenprotector from './screenprotector.native'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'

type OwnProps = {}

export default Container.connect(
  () => ({title: 'Screen Protector'}),
  dispatch => ({onBack: () => dispatch(RouteTreeGen.createNavigateUp())}),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
  })
)(Screenprotector)
