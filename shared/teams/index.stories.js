// @flow
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {BetaNote, Header} from './render'

const load = () => {
  storiesOf('Teams', module)
    .add('Header', () => <Header onCreateTeam={action('onCreateTeam')} onJoinTeam={action('onJoinTeam')} />)
    .add('BetaNote', () => <BetaNote onReadDoc={action('onReadDoc')} />)
}

export default load
