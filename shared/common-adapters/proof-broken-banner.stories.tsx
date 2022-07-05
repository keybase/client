import * as React from 'react'
import {Box2} from './box'
import ProofBrokenBanner from './proof-broken-banner'
import * as Sb from '../stories/storybook'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('ProofBrokenBanner', () => (
      <Box2 direction="vertical" fullWidth={true} gap="small">
        <ProofBrokenBanner users={['user1']} />
        <ProofBrokenBanner users={['user1', 'user2']} />
        <ProofBrokenBanner users={['user1', 'user2', 'user3']} />
      </Box2>
    ))
}

export default load
