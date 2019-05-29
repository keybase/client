import * as React from 'react'
import {storiesOf} from '../../../../../stories/storybook'
import SendIndicator from '.'

const load = () => {
  storiesOf('Chat/Conversation/Sending animation', module)
    // Use Math.random to get around local list we use to disable encrypting state
    .add('Encrypting', () => <SendIndicator sent={false} failed={false} id={Math.random()} />)
    .add('Sent', () => <SendIndicator sent={true} failed={false} />)
    .add('Failed', () => <SendIndicator sent={false} failed={true} />)
}

export default load
