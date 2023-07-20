import * as Kb from '../../../common-adapters'
import * as RouterConstants from '../../../constants/router2'
import * as Constants from '../../../constants/profile'
import Modal from '../../modal'

export default function Generate() {
  const cancelPgpGen = Constants.useState(s => s.dispatch.dynamic.cancelPgpGen)
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onCancel = () => {
    cancelPgpGen?.()
    clearModals()
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
