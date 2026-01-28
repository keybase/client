import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as Kb from '@/common-adapters'
import Modal from './modal'

const ProveWebsiteChoice = () => {
  const cancelAddProof = useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const addProof = useProfileState(s => s.dispatch.addProof)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    cancelAddProof?.()
    clearModals()
  }
  const onDNS = () => {
    addProof('dns', 'profile')
  }
  const onFile = () => {
    addProof('web', 'profile')
  }

  return (
    <Modal onCancel={onCancel}>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text center={true} type="Header">
          Prove your website in two ways:
        </Kb.Text>
        <Kb.ChoiceList
          options={[
            {
              description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
              icon: 'icon-file-txt-48',
              onClick: onFile,
              title: 'Host a TXT file',
            },
            {
              description: 'Place a Keybase proof in your DNS records.',
              icon: 'icon-dns-48',
              onClick: onDNS,
              title: 'Set a DNS',
            },
          ]}
        />
      </Kb.Box2>
    </Modal>
  )
}

export default ProveWebsiteChoice
