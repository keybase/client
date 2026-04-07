import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

const DbNukeConfirm = () => {
  const navigateUp = C.Router2.navigateUp
  const dbNuke = C.useRPC(T.RPCGen.ctlDbNukeRpcPromise)
  const onCancel = () => {
    navigateUp()
  }
  const onDBNuke = () => {
    navigateUp()
    dbNuke([undefined, C.waitingKeySettingsGeneric], () => {}, () => {})
  }

  return (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      flex={1}
      style={{padding: Kb.Styles.globalMargins.medium}}
    >
      <Kb.Text center={true} type="Header" style={{marginTop: Kb.Styles.globalMargins.medium, width: 320}}>
        Are you sure you want to blast away your local database?
      </Kb.Text>
      <Kb.ButtonBar>
        <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        <Kb.Button type="Danger" label="Yes, blow it away" onClick={onDBNuke} />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

export default DbNukeConfirm
