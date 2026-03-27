import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import Modal from './modal'

const ProveWebsiteChoice = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const onDNS = () => {
    navigateAppend({name: 'profileProofsList', params: {platform: 'dns'}})
  }
  const onFile = () => {
    navigateAppend({name: 'profileProofsList', params: {platform: 'web'}})
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
