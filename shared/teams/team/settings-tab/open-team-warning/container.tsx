import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import OpenTeamWarning from '.'

type OwnProps = Container.RouteProps<{
  isOpenTeam: boolean
  teamname: string
  onCancel: (() => void) | null
  onConfirm: (() => void) | null
}>

export default Container.connect(
  () => ({}),
  (dispatch, ownProps: OwnProps) => ({
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const onCancel: (() => void) | null = Container.getRouteProps(ownProps, 'onCancel', null)
      onCancel && onCancel()
    },
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      const cb: (() => void) | null = Container.getRouteProps(ownProps, 'onConfirm', null)
      cb && cb()
    },
  }),
  (_s, d, ownProps: OwnProps) => {
    const isOpenTeam = Container.getRouteProps(ownProps, 'isOpenTeam', false)
    const teamname = Container.getRouteProps(ownProps, 'teamname', '')
    return {
      ...ownProps,
      ...d,
      isOpenTeam,
      teamname,
    }
  }
)(OpenTeamWarning)
