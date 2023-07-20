import * as Kb from '../../common-adapters'
import * as RouterConstants from '../../constants/router2'
import Modal from '../modal'

export default function NoPGPView() {
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  return (
    <Modal onCancel={onCancel}>
      <Kb.Box2 direction="vertical" gap="small" gapEnd={true}>
        <Kb.Text center={true} type="Header">
          Add a PGP key
        </Kb.Text>
        <Kb.Text type="Body">For now, please use our desktop app to create PGP keys.</Kb.Text>
      </Kb.Box2>
    </Modal>
  )
}
