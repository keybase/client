// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
import SendIndicator from './chat-send'

const load = () => {
  storiesOf('Chat animation', module)
    .add('Encrypting', () => <SendIndicator sent={false} failed={false} />)
    .add('Sent', () => <SendIndicator sent={true} failed={false} />)
    .add('Failed', () => <SendIndicator sent={false} failed={true} />)
}

export default load
