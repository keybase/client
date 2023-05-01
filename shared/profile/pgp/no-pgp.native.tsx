import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Modal from '../modal'

export default function NoPGPView() {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
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
