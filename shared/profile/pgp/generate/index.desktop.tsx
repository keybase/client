import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import Modal from '@/profile/modal'

export default function Generate() {
  const cancelPgpGen = useProfileState(s => s.dispatch.dynamic.cancelPgpGen)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
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
