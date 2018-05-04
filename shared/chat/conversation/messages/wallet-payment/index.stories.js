// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
import {Text} from '../../../../common-adapters'

const load = () => {
  storiesOf('Chat/Conversation/Wallet payments', module).add('Receiving', () => (
    <Text type="BodyExtrabold">ayo wsup wsup</Text>
  ))
}

export default load
