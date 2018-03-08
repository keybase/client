// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
import SendIndicator from './chat-send'

const load = () => {
  storiesOf('Chat/Conversation/Sending animation', module)
    // Use Math.random to get around local list we use to disable encrypting state
    // $FlowIssue doesn't like HOCTimers
    .add('Encrypting', () => <SendIndicator sent={false} failed={false} id={Math.random()} />)
    // $FlowIssue doesn't like HOCTimers
    .add('Sent', () => <SendIndicator sent={true} failed={false} />)
    // $FlowIssue doesn't like HOCTimers
    .add('Failed', () => <SendIndicator sent={false} failed={true} />)
}

export default load
