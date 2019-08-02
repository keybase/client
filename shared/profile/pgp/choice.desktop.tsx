import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import Modal from '../modal'

type OwnProps = {}

const Choice = p => (
  <Modal onCancel={p.onCancel}>
    <Kb.Box2 direction="vertical" gap="small">
      <Kb.Text type="Header">Add a PGP key</Kb.Text>
      <Kb.ChoiceList
        options={[
          {
            description: 'Keybase will generate a new PGP key and add it to your profile.',
            icon: 'icon-pgp-key-new-48',
            onClick: p.onShowGetNew,
            title: 'Get a new PGP key',
          },
          {
            description: 'Import an existing PGP key to your Keybase profile.',
            icon: 'icon-pgp-key-import-48',
            onClick: p.onShowImport,
            title: 'I have one already',
          },
        ]}
      />
    </Kb.Box2>
  </Modal>
)

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createClearModals()),
  onShowGetNew: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileProvideInfo']})),
  onShowImport: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileImport']})),
})

export default namedConnect(() => ({}), mapDispatchToProps, (s, d, o: OwnProps) => ({...o, ...s, ...d}), 'Choice')(
  Choice
)
