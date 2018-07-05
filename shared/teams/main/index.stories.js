// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import BetaNote from './beta-note'
import Header from './header'
import TeamList from './team-list'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'

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

const provider = PropProviders.CommonProvider()

const load = () => {
  storiesOf('Teams/Main', module)
    .addDecorator(provider)
    .add('Header', () => (
      <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} loaded={true} />
    ))
    .add('BetaNote', () => <BetaNote onReadMore={action('onReadMore')} />)
    .add('TeamList', () => (
      <Box style={{maxWidth: 320}}>
        <TeamList
          teamnames={teamnames}
          newTeams={[]}
          teamNameToIsOpen={teamNameToIsOpen}
          newTeamRequests={['techtonica']}
          teammembercounts={teammembercounts}
          teamresetusers={{}}
          onOpenFolder={action('onOpenFolder')}
          onManageChat={action('onManageChat')}
          onViewTeam={action('onViewTeam')}
        />
      </Box>
    ))
}

export default load
