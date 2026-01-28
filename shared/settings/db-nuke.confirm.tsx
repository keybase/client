import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useSettingsState} from '@/stores/settings'

const DbNukeConfirm = () => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const dbNuke = useSettingsState(s => s.dispatch.dbNuke)
  const onDBNuke = () => {
    navigateUp()
    dbNuke()
  }

  return (
    <Kb.Box
      style={{
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: Kb.Styles.globalMargins.medium,
      }}
    >
      <Kb.Text center={true} type="Header" style={{marginTop: Kb.Styles.globalMargins.medium, width: 320}}>
        Are you sure you want to blast away your local database?
      </Kb.Text>
      <Kb.ButtonBar>
        <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        <Kb.Button type="Danger" label="Yes, blow it away" onClick={onDBNuke} />
      </Kb.ButtonBar>
    </Kb.Box>
  )
}

export default DbNukeConfirm
