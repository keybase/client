// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import Modal from '../modal'

type OwnProps = {||}

const Choice = ({onCancel, onOptionClick}) => (
  <Modal onCancel={onCancel}>
    <Kb.Box2 direction="vertical" gap="small">
      <Kb.Text type="Header">Add a PGP key</Kb.Text>
      <Kb.ChoiceList
        options={[
          {
            description: 'Keybase will generate a new PGP key and add it to your profile.',
            icon: 'icon-pgp-key-new-48',
            onClick: () => onOptionClick('provideInfo'),
            title: 'Get a new PGP key',
          },
          {
            description: 'Import an existing PGP key to your Keybase profile.',
            icon: 'icon-pgp-key-import-48',
            onClick: () => onOptionClick('import'),
            title: 'I have one already',
          },
        ]}
      />
    </Kb.Box2>
  </Modal>
)

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(RouteTreeGen.createClearModals())
  },
  onOptionClick: (type: 'import' | 'provideInfo') =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [type]})),
})

export default namedConnect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Choice'
)(Choice)
