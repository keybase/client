import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import Modal from '../modal'

export default function NoPGPView() {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  return (
    <Modal onCancel={onCancel}>
      <Kb.Box2 direction="vertical" gap="small" gapEnd={true}>
        <Kb.Text3 center={true} type="Header">
          Add a PGP key
        </Kb.Text3>
        <Kb.Text3 type="Body">For now, please use our desktop app to create PGP keys.</Kb.Text3>
      </Kb.Box2>
    </Modal>
  )
}
