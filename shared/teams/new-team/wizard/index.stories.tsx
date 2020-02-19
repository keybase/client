import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import CreateChannels from './create-channels'

const load = () => {
  Sb.storiesOf('Teams/New team wizard', module).add('5 - Create channels', () => (
    <CreateChannels teamname="greenpeace" />
  ))
}

export default load
