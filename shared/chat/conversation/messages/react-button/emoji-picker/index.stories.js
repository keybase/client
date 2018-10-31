// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import ChooseEmoji from '.'

const load = () =>
  storiesOf('Chat/Emoji picker', module)
    .addDecorator(story => <Box style={{height: 400, overflow: 'hidden', width: 300}}>{story()}</Box>)
    .add('Default', () => <ChooseEmoji onChoose={action('onChoose')} width={300} />)

export default load
