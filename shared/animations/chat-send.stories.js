// @flow
import * as React from 'react'
import {storiesOf} from '../stories/storybook'
import {SendAnimation} from './chat-send'

const load = () => {
  storiesOf('Chat animation', module).add('One to two', () => <SendAnimation />)
}

export default load
