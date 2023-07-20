import * as RouterConstants from '../../constants/router2'
import DBNukeConfirm from '.'
import * as Constants from '../../constants/settings'

export default () => {
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
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
