import * as Kb from '../../../common-adapters'
import * as C from '../../../constants'
import Modal from '../../modal'

export default function Choice() {
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    clearModals()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onShowGetNew = () => {
    navigateAppend('profileProvideInfo')
  }
  const onShowImport = () => {
    navigateAppend('profileImport')
  }
  return (
    <Modal onCancel={onCancel}>
      <Kb.Box2 direction="vertical" gap="small">
        <Kb.Text type="Header">Add a PGP key</Kb.Text>
        <Kb.ChoiceList
          options={[
            {
              description: 'Keybase will generate a new PGP key and add it to your profile.',
              icon: 'icon-pgp-key-new-48',
              onClick: onShowGetNew,
              title: 'Get a new PGP key',
            },
            {
              description: 'Import an existing PGP key to your Keybase profile.',
              icon: 'icon-pgp-key-import-48',
              onClick: onShowImport,
              title: 'I have one already',
            },
          ]}
        />
      </Kb.Box2>
    </Modal>
  )
}
