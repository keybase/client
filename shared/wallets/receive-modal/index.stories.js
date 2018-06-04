// @flow
import React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import ReceiveModal from '.'

const load = () => {
  storiesOf('Wallets', module).add('Receive', () => <ReceiveModal onClose={action('onClose')} />)
}

export default load
