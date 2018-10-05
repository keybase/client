// @flow
import * as Container from '../../util/container'
import type {RouteProps} from '../../route-tree/render-route'
import TODORoute from '.'

type OwnProps = RouteProps<{}, {}>

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
})

const ConnectedTODORoute = Container.connect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({
    ...o,
    ...s,
    ...d,
  })
)(TODORoute)

export default ConnectedTODORoute
