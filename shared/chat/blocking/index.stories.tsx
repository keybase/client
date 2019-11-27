/* eslint-disable sort-keys */
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import BlockModal from './block-modal/container'
import Invitation from './invitation-to-block'

const others = ['max', 'patrick', 'strib']
const fakeConvID = 'fakeConvID1234'

const load = () => {
  Sb.storiesOf('Chat/Blocking', module)
    .add('Implicit team', () => (
      <BlockModal
        {...Sb.createNavigator({username: 'chris', others, blockByDefault: true, convID: fakeConvID})}
      />
    ))
    .add('Team', () => (
      <BlockModal
        {...Sb.createNavigator({
          username: 'chris',
          team: 'keybase',
          blockByDefault: true,
          convID: fakeConvID,
        })}
      />
    ))
    .add('1on1', () => (
      <BlockModal {...Sb.createNavigator({username: 'chris', blockByDefault: true, convID: fakeConvID})} />
    ))
    .add('From profile', () => <BlockModal {...Sb.createNavigator({username: 'chris'})} />)
  Sb.storiesOf('Chat/Blocking', module)
    .add('Implicit team invitation', () => <Invitation adder="chris" others={others} />)
    .add('Team invitation', () => <Invitation adder="chris" team="keybase" />)
    .add('1on1 invitation', () => <Invitation adder="chris" />)
}

export default load
