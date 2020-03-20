import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import CreateChannels from './create-channels'
import CreateSubteams from './create-subteams'
import WhatKind from './team-purpose'
import NewTeamInfo from './new-team-info'
import MakeBigTeam from './make-big-team'
import {store} from '../../stories'

const load = () => {
  Sb.storiesOf('Teams/New team wizard', module)
    .addDecorator(Sb.updateStoreDecorator(store, () => {}))
    .add('1 - Team Purpose', () => <WhatKind />)
    .add('2 - Team info', () => <NewTeamInfo />)
    .add('4 - Team size', () => <MakeBigTeam />)
    .add('5 - Create channels', () => <CreateChannels />)
    .add('6 - Create subteams', () => <CreateSubteams />)
}

export default load
