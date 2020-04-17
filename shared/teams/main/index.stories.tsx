import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/teams'
import TeamsFooter from './footer'
import Header from './header'
import TeamList from '.'
import {Box} from '../../common-adapters'

const teams = [
  Constants.makeTeamMeta({
    isMember: true,
    isOpen: true,
    memberCount: 5,
    teamname: 'stripe',
  }),
  Constants.makeTeamMeta({
    isMember: false,
    isOpen: false,
    memberCount: 1,
    teamname: 'stripe.usa',
  }),
  Constants.makeTeamMeta({
    id: 'techtonica_id',
    isMember: true,
    isOpen: true,
    memberCount: 1,
    teamname: 'techtonica',
  }),
  Constants.makeTeamMeta({
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
    .add('No teams placeholder', () => <TeamsFooter empty={false} />)
    .add('Empty footer', () => <TeamsFooter empty={true} />)
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
          newTeamRequests={new Map([['techtonica_id', new Set(['a', 'b'])]])}
          teamresetusers={new Map()}
          onOpenFolder={Sb.action('onOpenFolder')}
          onManageChat={Sb.action('onManageChat')}
          onViewTeam={Sb.action('onViewTeam')}
          teams={teams}
        />
      </Box>
    ))
}

export default load
