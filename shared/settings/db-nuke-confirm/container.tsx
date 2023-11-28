import * as C from '@/constants'
import DBNukeConfirm from '.'

const Container = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const dbNuke = C.useSettingsState(s => s.dispatch.dbNuke)
  const onDBNuke = () => {
    navigateUp()
    dbNuke()
  }
  const props = {onCancel, onDBNuke}
  return <DBNukeConfirm {...props} />
}

export default Container
