// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {BetaNote, Header, TeamList} from '.'
import {Box} from '../common-adapters'

const teamnames = ['stripe', 'stripe.usa', 'techtonica']

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} />)
    .add('BetaNote', () => <BetaNote onReadMore={action('onReadMore')} />)
    .add('TeamList', () => (
      <Box style={{maxWidth: 320}}>
        <TeamList teamnames={teamnames} />
      </Box>
    ))
}

export default load
