import * as React from 'react'
import {storiesOf} from '../../../../../stories/storybook'
import SendIndicator from '.'

const load = () => {
  storiesOf('Chat/Conversation/Sending animation', module)
    // Use Math.random to get around local list we use to disable encrypting state
    .add('Encrypting', () => (
      <SendIndicator sent={false} failed={false} id={Math.random()} isExploding={false} />
    ))
    .add('Encrypting Exploding', () => (
      <SendIndicator sent={false} failed={false} id={Math.random()} isExploding={true} />
    ))
    .add('Sent', () => <SendIndicator sent={true} failed={false} isExploding={false} />)
    .add('Failed', () => <SendIndicator sent={false} failed={true} isExploding={false} />)
}

export default load
