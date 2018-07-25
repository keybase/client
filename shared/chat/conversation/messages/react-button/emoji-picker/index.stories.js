// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../../../stories/storybook'
import ChooseEmoji from '.'

const load = () => {
  storiesOf('Chat/Emoji picker', module).add('Default', () => <ChooseEmoji width={200} />)
}

export default load
