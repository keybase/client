// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
import {Box} from '../../../../common-adapters'
import Payment from '.'

const load = () => {
  storiesOf('Chat/Conversation/Wallet payments', module)
    .addDecorator(story => <Box style={{width: 420}}>{story()}</Box>)
    .add('Receiving', () => <Payment />)
}

export default load
