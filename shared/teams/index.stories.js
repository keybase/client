// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {BetaNote, Header, TeamList} from './render'

const teams = [{name: 'stripe'}, {name: 'stripe.usa'}, {name: 'techtonica'}]

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} />)
    .add('BetaNote', () => <BetaNote onReadDoc={action('onReadDoc')} />)
    .add('TeamList', () => <TeamList teams={teams} />)
}

export default load
