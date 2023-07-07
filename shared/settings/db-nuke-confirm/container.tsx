import * as RouteTreeGen from '../../actions/route-tree-gen'
import DBNukeConfirm from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'

export default () => {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const dbNuke = Constants.useState(s => s.dispatch.dbNuke)
  const onDBNuke = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dbNuke()
  }
  const props = {onCancel, onDBNuke}
  return <DBNukeConfirm {...props} />
}
