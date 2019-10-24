import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/teams'
import NoTeamsPlaceholder from './no-teams-placeholder'
import Header from './header'
import TeamList from '.'
import {Box} from '../../common-adapters'

const teams = [
  Constants.makeTeamDetails({
    isMember: true,
    isOpen: true,
    memberCount: 5,
    teamname: 'stripe',
  }),
  Constants.makeTeamDetails({
    isMember: false,
    isOpen: false,
    memberCount: 1,
    teamname: 'stripe.usa',
  }),
  Constants.makeTeamDetails({
    isMember: true,
    isOpen: true,
    memberCount: 1,
    teamname: 'techtonica',
  }),
  Constants.makeTeamDetails({
    id: 'ted_talks_inc_id',
    isMember: true,
    isOpen: false,
    memberCount: 3,
    teamname: 'ted_talks_inc',
  }),
]

const load = () => {
  Sb.storiesOf('Teams/Main', module)
    .add('Header', () => (
      <Header onCreateTeam={Sb.action('onCreateTeam')} onJoinTeam={Sb.action('onJoinTeam')} loaded={true} />
    ))
    .add('No teams placeholder', () => <NoTeamsPlaceholder />)
    .add('TeamList', () => (
      <Box style={{display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 320}}>
        <TeamList
          deletedTeams={[]}
          newTeams={new Set(['ted_talks_inc_id'])}
          loaded={true}
          onReadMore={Sb.action('onReadMore')}
          onJoinTeam={Sb.action('onJoinTeam')}
          onCreateTeam={Sb.action('onCreateTeam')}
          onHideChatBanner={Sb.action('onHideChatBanner')}
          sawChatBanner={Sb.action('sawChatBanner')}
          teamToRequest={{techtonica: 2}}
          teamresetusers={{}}
          onOpenFolder={Sb.action('onOpenFolder')}
          onManageChat={Sb.action('onManageChat')}
          onViewTeam={Sb.action('onViewTeam')}
          teams={teams}
        />
      </Box>
    ))
}

export default load
