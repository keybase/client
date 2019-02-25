// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import BetaNote from './beta-note'
import Header from './header'
import TeamList from '.'
import {Box} from '../../common-adapters'

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
  Sb.storiesOf('Teams/Main', module)
    .add('Header', () => (
      <Header onCreateTeam={Sb.action('onCreateTeam')} onJoinTeam={Sb.action('onJoinTeam')} loaded={true} />
    ))
    .add('BetaNote', () => <BetaNote onReadMore={Sb.action('onReadMore')} />)
    .add('TeamList', () => (
      <Box style={{display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 320}}>
        <TeamList
          teamnames={teamnames}
          newTeams={[]}
          loaded={true}
          onReadMore={Sb.action('onReadMore')}
          onJoinTeam={Sb.action('onJoinTeam')}
          onCreateTeam={Sb.action('onCreateTeam')}
          onHideChatBanner={Sb.action('onHideChatBanner')}
          sawChatBanner={Sb.action('sawChatBanner')}
          teamNameToIsOpen={teamNameToIsOpen}
          teamToRequest={{techtonica: 2}}
          teammembercounts={teammembercounts}
          teamresetusers={{}}
          onOpenFolder={Sb.action('onOpenFolder')}
          onManageChat={Sb.action('onManageChat')}
          onViewTeam={Sb.action('onViewTeam')}
        />
      </Box>
    ))
}

export default load
