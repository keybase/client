import * as React from 'react'
import * as Kb from '../../common-adapters'
import Modal from '../modal'

type Props = {
  onFile: () => void
  onDNS: () => void
  onCancel: () => void
}

const ProveWebsiteChoice = (p: Props) => (
  <Modal onCancel={p.onCancel}>
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text center={true} type="Header">
        Prove your website in two ways:
      </Kb.Text>
      <Kb.ChoiceList
        options={[
          {
            description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
            icon: 'icon-file-txt-48',
            onClick: p.onFile,
            title: 'Host a TXT file',
          },
          {
            description: 'Place a Keybase proof in your DNS records.',
            icon: 'icon-dns-48',
            onClick: p.onDNS,
            title: 'Set a DNS',
          },
        ]}
      />
    </Kb.Box2>
  </Modal>
)

export default ProveWebsiteChoice
