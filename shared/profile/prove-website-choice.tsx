import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import Modal from './modal'

const ProveWebsiteChoice = () => {
  const navigateAppend = C.Router2.navigateAppend
  const navigateUp = C.Router2.navigateUp
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
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
          <Kb.ListItem
            type="Card"
            firstItem={true}
            icon={<Kb.IconAuto type="icon-file-txt-48" />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodyBigLink">Host a TXT file</Kb.Text>
                <Kb.Text type="Body">Host a text file on your site, such as yoursite.com/keybase.txt.</Kb.Text>
              </Kb.Box2>
            }
            onClick={onFile}
          />
          <Kb.ListItem
            type="Card"
            firstItem={true}
            icon={<Kb.IconAuto type="icon-dns-48" />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodyBigLink">Set a DNS</Kb.Text>
                <Kb.Text type="Body">Place a Keybase proof in your DNS records.</Kb.Text>
              </Kb.Box2>
            }
            onClick={onDNS}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Modal>
  )
}

export default ProveWebsiteChoice
