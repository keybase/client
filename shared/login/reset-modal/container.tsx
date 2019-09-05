import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ResetModal from '.'

type OwnProps = {}

export default Container.connect(
  _ => ({}),
  dispatch => ({
    onCancelReset: () => dispatch(RouteTreeGen.createClearModals()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    timeLeft: '2 days',
  })
)(ResetModal)
