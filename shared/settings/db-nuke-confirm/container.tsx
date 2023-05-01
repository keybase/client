import * as RouteTreeGen from '../../actions/route-tree-gen'
import DBNukeConfirm from '.'
import {createDbNuke} from '../../actions/settings-gen'
import * as Container from '../../util/container'

export default () => {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onDBNuke = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(createDbNuke())
  }
  const props = {onCancel, onDBNuke}
  return <DBNukeConfirm {...props} />
}
