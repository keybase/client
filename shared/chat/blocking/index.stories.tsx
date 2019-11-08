/* eslint-disable sort-keys */
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import BlockModal from './block-modal'
import Invitation from './invitation-to-block'

const others = ['max', 'patrick', 'strib']

const load = () => {
  Sb.storiesOf('Chat/Blocking', module)
    .add('Implicit team', () => <BlockModal {...Sb.createNavigator({adder: 'chris', others})} />)
    .add('Team', () => <BlockModal {...Sb.createNavigator({adder: 'chris', team: 'keybase'})} />)
    .add('1on1', () => <BlockModal {...Sb.createNavigator({adder: 'chris'})} />)
  Sb.storiesOf('Chat/Blocking', module)
    .add('Implicit team invitation', () => <Invitation adder="chris" others={others} />)
    .add('Team invitation', () => <Invitation adder="chris" team="keybase" />)
    .add('1on1 invitation', () => <Invitation adder="chris" />)
}

export default load
