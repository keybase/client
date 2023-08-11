import * as C from '../../constants'
import DBNukeConfirm from '.'
import * as Constants from '../../constants/settings'

export default () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const dbNuke = Constants.useState(s => s.dispatch.dbNuke)
  const onDBNuke = () => {
    navigateUp()
    dbNuke()
  }
  const props = {onCancel, onDBNuke}
  return <DBNukeConfirm {...props} />
}
