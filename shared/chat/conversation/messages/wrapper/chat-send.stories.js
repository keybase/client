// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
import SendAnimation from './chat-send'

const load = () => {
  storiesOf('Chat animation', module)
    .add('Encrypting', () => <SendAnimation sent={false} failed={false} />)
    .add('Sent', () => <SendAnimation sent={true} failed={false} />)
    .add('Failed', () => <SendAnimation sent={false} failed={true} />)
}

export default load
