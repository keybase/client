// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {Box} from '../common-adapters'
import {BetaNote, Header, TeamList} from './render'

const teamnames = ['stripe', 'stripe.usa', 'techtonica']

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} />)
    .add('BetaNote', () => <BetaNote onReadDoc={action('onReadDoc')} />)
    .add('TeamList', () => (
      <Box style={{marginLeft: 10, marginRight: 10, maxWidth: 320}}>
        <TeamList teamnames={teamnames} />
      </Box>
    ))
}

export default load
