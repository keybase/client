// @flow
import * as React from 'react'
import BetaNote from './main/beta-note'
import Header from './main/header'
import TeamList from './main/team-list'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

const teamnames = ['stripe', 'stripe.usa', 'techtonica']

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} />)
    .add('BetaNote', () => <BetaNote onReadMore={action('onReadMore')} />)
    .add('TeamList', () => (
      <Box style={{maxWidth: 320}}>
        <TeamList
          teamnames={teamnames}
          onOpenFolder={action('onOpenFolder')}
          onManageChat={action('onManageChat')}
          onViewTeam={action('onViewTeam')}
        />
      </Box>
    ))
}

export default load
