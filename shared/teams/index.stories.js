// @flow
import * as React from 'react'
import BetaNote from './main/beta-note'
import Header from './main/header'
import TeamList from './main/team-list'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

const teamnames = ['stripe', 'stripe.usa', 'techtonica']
const teammembercounts = {
  stripe: 5,
  'stripe.usa': 1,
  techtonica: 0,
}
const teamNameToIsOpen = {
  stripe: true,
  'stripe.usa': false,
  techtonica: true,
}

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => (
      <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} loaded={true} />
    ))
    .add('BetaNote', () => <BetaNote onReadMore={action('onReadMore')} />)
    .add('TeamList', () => (
      <Box style={{maxWidth: 320}}>
        <TeamList
          teamnames={teamnames}
          teamNameToIsOpen={teamNameToIsOpen}
          newTeams={['stripe.usa']}
          newTeamRequests={['techtonica']}
          teammembercounts={teammembercounts}
          onOpenFolder={action('onOpenFolder')}
          onManageChat={action('onManageChat')}
          onViewTeam={action('onViewTeam')}
        />
      </Box>
    ))
}

export default load
