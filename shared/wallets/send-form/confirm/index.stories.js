// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ConfirmSend from '.'

const load = () => {
  // full component
  Sb.storiesOf('Wallets/SendForm', module)
    // .addDecorator(provider)
    .add('Confirm', () => <ConfirmSend onClose={Sb.action('onClose')} onBack={Sb.action('onClose')} />)
}

export default load
