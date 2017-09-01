// @flow
import React from 'react'
import {Box} from '../../../common-adapters'
import {storiesOf} from '../../../stories/storybook'

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module).add('Small team', () => {
    return <Box>Hello world!</Box>
  })
}

export default load
