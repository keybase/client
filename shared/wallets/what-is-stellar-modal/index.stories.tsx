import * as React from 'react'
import * as Sb from '../../stories/storybook'
import WhatIsStellarModal from '.'

const load = () => {
  Sb.storiesOf('Wallets', module).add('What is Stellar? Modal', () => (
    <WhatIsStellarModal onCancel={Sb.action('onClose')} customCancelText="Close" />
  ))
}

export default load
