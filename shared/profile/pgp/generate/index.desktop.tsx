import * as Kb from '../../../common-adapters'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'
import Modal from '../../modal'

export default function Generate() {
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(ProfileGen.createCancelPgpGen())
    dispatch(RouteTreeGen.createClearModals())
  }
  return (
    <Modal onCancel={onCancel}>
      <Kb.Box2 direction="vertical" gap="small" alignItems="center">
        <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" />
        <Kb.Text type="Header">Generating your unique key...</Kb.Text>
        <Kb.Text type="Body">
          Math time! You are about to discover a 4096-bit key pair.
          <br />
          This could take as long as a couple of minutes.
        </Kb.Text>
        <Kb.Animation animationType="loadingInfinity" height={100} width={100} />
      </Kb.Box2>
    </Modal>
  )
}