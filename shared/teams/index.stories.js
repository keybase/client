// @flow
import * as React from 'react'
import BetaNote from './main/beta-note'
import Header from './main/header'
import TeamList from './main/team-list'
import {makeTeamListRow} from '../constants/teams'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'

const teamrows = [
  makeTeamListRow({teamName: 'stripe', memberCount: 1}),
  makeTeamListRow({teamName: 'stripe.usa', memberCount: 6}),
  makeTeamListRow({teamName: 'techtonica', memberCount: 0}),
]

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} />)
    .add('BetaNote', () => <BetaNote onReadMore={action('onReadMore')} />)
    .add('TeamList', () => (
      <Box style={{maxWidth: 320}}>
        <TeamList
          teamrows={teamrows}
          onOpenFolder={action('onOpenFolder')}
          onManageChat={action('onManageChat')}
          onViewTeam={action('onViewTeam')}
        />
      </Box>
    ))
}

export default load
