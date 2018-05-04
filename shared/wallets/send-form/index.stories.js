// @flow
import React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import SendForm from '.'

const load = () => {
  storiesOf('Wallets/SendForm', module).add('Send', () => (
    <SendForm skeleton={null} onClick={action('onClick')} />
  ))
}

export default load
