import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import CreateChannels from './create-channels'
import CreateSubteams from './create-subteams'

const load = () => {
  Sb.storiesOf('Teams/New team wizard', module)
    .add('5 - Create channels', () => <CreateChannels teamname="greenpeace" />)
    .add('6 - Create subteams', () => <CreateSubteams teamname="greenpeace" />)
}

export default load
